"""Bake visible photographed cloth detail into the original scan's editable base colour atlas.

Supply a registered RGB casting photograph, its standing-fit.json, a gameplay
export made from the uncorrected scan and the untouched scan GLB. The segmenter
option enables Ida's red-jacket/grey-tee/blue-denim mask calibration. Supply an
artist-authored categorical PNG (--garment-mask) for different palettes. Labels
are 0 background/skin/hair, 1 jacket, 2 tee, 3 jeans and 4 shoes.
"""

import argparse
import ctypes
import hashlib
import io
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def base_atlas(package, name):
    data = package.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    if (magic, version, length) != (b"glTF", 2, len(data)):
        raise ValueError(f"Expected a complete GLB 2 package at {package}")
    header_size = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + header_size])
    materials = document["materials"]
    if name is None and len(materials) != 1:
        raise ValueError("Select the scan material explicitly with --scan-material.")
    material = next((m for m in materials if name is None or m.get("name") == name), None)
    if material is None:
        raise ValueError(f"Missing material {name!r} in {package}")
    texture = document["textures"][material["pbrMetallicRoughness"]["baseColorTexture"]["index"]]
    index = texture.get("extensions", {}).get("EXT_texture_webp", {}).get("source", texture.get("source"))
    view = document["bufferViews"][document["images"][index]["bufferView"]]
    start = 28 + header_size + view.get("byteOffset", 0)
    payload = data[start:start + view["byteLength"]]
    return np.array(Image.open(io.BytesIO(payload)).convert("RGB")), hashlib.sha256(payload).hexdigest()


def rasterizer(temp, compiler):
    library = temp / ("raster.dylib" if sys.platform == "darwin" else "raster.so")
    subprocess.run([compiler, "-std=c++17", "-O3", "-shared", "-fPIC",
                    str(Path(__file__).with_name("raster_workwear.cpp")), "-o", str(library)], check=True)
    function = ctypes.CDLL(str(library)).raster
    function.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                         ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]
    function.restype = None

    def raster(triangles, width, height):
        coords = np.ascontiguousarray(triangles, dtype="f")
        identity = np.full((height, width), -1, "i")
        mix = np.zeros((height, width, 2), "f")
        depth = np.full((height, width), -1e9, "f")
        function(coords.ctypes.data, len(coords), width, height, identity.ctypes.data,
                 mix.ctypes.data, depth.ctypes.data)
        return identity, mix, depth

    return raster


def ida_mask(photo, actual, model_path):
    import mediapipe as mp
    options = mp.tasks.vision.ImageSegmenterOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        output_category_mask=True, output_confidence_masks=False)
    with mp.tasks.vision.ImageSegmenter.create_from_options(options) as segmenter:
        result = segmenter.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=photo))
        subject = result.category_mask.numpy_view().squeeze().copy()
    near = [cv2.distanceTransform(np.uint8(actual != code), cv2.DIST_L2, 5) for code in range(1, 5)]
    closest = np.argmin(near, axis=0) + 1
    r, g, b = photo.astype("f").transpose(2, 0, 1)
    red = (r > g * 1.22 + 8) & (r > b * 1.20 + 5)
    skin = (r > g * 1.13 + 5) & (g > b * 1.09 + 4) & (r > 82)
    label = closest.astype("uint8")
    label[(closest <= 2) & red] = 1
    label[(closest <= 2) & ~red] = 2
    label[(subject != 4) | skin] = 0
    label[(near[0] < 10) & red & ~skin] = 1
    leg, shoe = near[2] < 28, near[3] < 20
    neutral = (abs(r - b) < 14) & (abs(g - b) < 14)
    label[(subject == 4) & leg & ~shoe] = 3
    label[(subject == 4) & shoe & neutral & (closest == 4)] = 4
    return label


def row_edges(mask, lo, hi):
    edges = np.full((mask.shape[0], 2), np.nan, "f")
    for y, row in enumerate(mask[:, lo:hi]):
        active = np.flatnonzero(row)
        if active.size > 4:
            edges[y] = (lo + active[1], lo + active[-2])
    for column in range(2):
        rows = np.flatnonzero(np.isfinite(edges[:, column]))
        if not len(rows):
            return None
        edges[:, column] = np.interp(np.arange(len(mask)), rows, edges[rows, column])
    return cv2.GaussianBlur(edges, (1, 15), 4.0)


def align_hem(photo, target, source, halves):
    h, w = target.shape
    start, end = np.percentile(np.nonzero(target)[0], [.4, 99.6])
    first, last = np.percentile(np.nonzero(source)[0], [.4, 99.6])
    sy = np.clip(first + (np.arange(h) - start) * (last - first) / max(1, end - start), 0, h - 1)
    x = np.broadcast_to(np.arange(w, dtype="f"), (h, w)).copy()
    for lo, hi in halves:
        left = row_edges(target, lo, hi)
        right = row_edges(source, lo, hi)
        if left is None or right is None:
            continue
        right = np.column_stack([np.interp(sy, np.arange(h), right[:, j]) for j in range(2)])
        scale = (right[:, 1] - right[:, 0]) / np.maximum(left[:, 1] - left[:, 0], 1)
        fitted = right[:, 0, None] + (x[:, lo:hi] - left[:, 0, None]) * np.clip(scale, .84, 1.18)[:, None]
        x[:, lo:hi] += np.clip(fitted - x[:, lo:hi], -25, 25)
    y = np.broadcast_to(np.arange(h)[:, None], (h, w)).astype("f")
    y += np.clip(sy.astype("f")[:, None] - np.arange(h)[:, None], -24, 24).astype("f")
    donor = cv2.remap(photo, x, y, cv2.INTER_LINEAR)
    visible = cv2.remap(source.astype("uint8"), x, y, cv2.INTER_NEAREST) > 0
    return donor, target & visible


def photo_residual(photo, render, actual, source, center):
    h, w = actual.shape
    corrections = np.zeros((h, w, 3), "f")
    counts = {}
    for code in range(1, 5):
        target = actual == code
        donor_region = source == code
        if not target.any() or not donor_region.any():
            continue
        halves = [(0, w)] if code < 3 else [(0, center), (center, w)]
        donor, good = align_hem(photo, target, donor_region, halves)
        direct = target & donor_region
        interior = np.clip(cv2.distanceTransform(direct.astype("uint8"), cv2.DIST_L2, 5) / 13, 0, 1)
        donor = np.rint(donor * (1 - interior[:, :, None]) + photo * interior[:, :, None]).astype("uint8")
        good |= direct
        soft = cv2.distanceTransform(good.astype("uint8"), cv2.DIST_L2, 5).clip(0, 9) / 9

        # Suppress broad illumination imbalance while keeping local weave and
        # pocket wear. Using the actual shaded render as denominator preserves
        # the direction-dependent contribution of the existing normal map.
        ratio = np.clip(np.log((donor.astype("f") + 8) / (render.astype("f") + 8)), -.75, .75)
        flags = good.astype("f")
        weight = cv2.GaussianBlur(flags, (0, 0), 35)
        slow = cv2.GaussianBlur(ratio * flags[:, :, None], (0, 0), 35) / np.maximum(.0001, weight[:, :, None])
        detail = ratio - .28 * slow
        if np.any(soft > .75):
            detail -= np.mean(detail[soft > .75], axis=0)
        corrections += np.clip(detail, -.62, .62) * soft[:, :, None] * .96
        counts[code] = {"validPhotoPixels": int(good.sum()), "projectedPixels": int(target.sum())}
    return corrections, counts


def atlas_projection(runtime, native, screen, uv, normal, code, depth, actual, residual, raster):
    H, W = runtime.shape[:2]
    h, w = actual.shape
    visible = code > 0
    screen, normal, code = screen[visible], normal[visible], code[visible]
    atlas_coords = np.zeros(screen.shape, "f")
    atlas_coords[:, :, :2] = uv[visible] * np.float32([W, H]) - .5
    result = native.copy()
    modified = 0
    for top in range(0, H, 256):
        height = min(256, H - top)
        intersect = (atlas_coords[:, :, 1].max(1) >= top) & (atlas_coords[:, :, 1].min(1) < top + height)
        group = np.flatnonzero(intersect)
        triangles = atlas_coords[group].copy()
        triangles[:, :, 1] -= top
        index, weights, _ = raster(triangles, W, height)
        vy, vx = np.nonzero(index >= 0)
        ids = group[index[vy, vx]]
        a, b = weights[vy, vx].T
        points = screen[ids, 0] * (1 - a - b)[:, None] + screen[ids, 1] * a[:, None] + screen[ids, 2] * b[:, None]
        x = np.clip(np.rint(points[:, 0]).astype("i"), 0, w - 1)
        y = np.clip(np.rint(points[:, 1]).astype("i"), 0, h - 1)
        front = (depth[y, x] - points[:, 2] < .005) & (code[ids] == actual[y, x])
        incidence = np.clip((-normal[ids, 1] - .12) / .54, 0, 1)
        gain = np.exp(residual[y, x] * (front * incidence)[:, None])
        original = runtime[vy + top, vx].astype("f")
        calibrated = np.rint(np.clip((original + 8) * gain - 8, 0, 255))
        gain = (calibrated + 8) / (original + 8)
        genuine = native[vy + top, vx].astype("f")
        result[vy + top, vx] = np.rint(np.clip((genuine + 8) * gain - 8, 0, 255))
        modified += int(np.any(original != calibrated, axis=1).sum())
    return result, modified


def bake(args, temp):
    helpers = Path(__file__).parent
    fit = json.loads(args.fit.read_text())
    photo_hash = digest(args.reference)
    if fit["referenceSha256"] != photo_hash:
        raise ValueError("The casting photo differs from the registered photo in standing-fit.json.")
    photo = np.array(Image.open(args.reference).convert("RGB"))
    height, width = photo.shape[:2]
    if fit["imagePixels"] != [width, height]:
        raise ValueError("Casting photograph dimensions differ from standing-fit.json.")
    registrations = fit["registration"]
    runtime, runtime_digest = base_atlas(args.package, args.material)
    native, native_digest = base_atlas(args.scan, args.scan_material)
    if native.shape != runtime.shape:
        raise ValueError("The original scan and game base colour atlases must have identical dimensions.")
    drift = 0.0
    for top in range(0, len(native), 256):
        rows = slice(top, top + 256)
        drift += np.abs(native[rows].astype("i2") - runtime[rows].astype("i2")).sum()
    drift = float(drift / native.size)
    if drift > 4:
        raise ValueError(f"Gameplay albedo does not match the untouched scan (mean RGB difference {drift:.2f}).")

    blender = [args.blender, "-b", "--threads", "2", "--python-exit-code", "1"]
    posed = temp / "pose.npz"
    subprocess.run(blender + ["-P", str(helpers / "extract_workwear_pose.py"), "--",
                              str(args.package), str(posed), "--frame", str(args.frame)], check=True)
    render = args.baseline
    if render is None:
        render = temp / "baseline.png"
        subprocess.run(blender + ["-P", str(args.standing_renderer or helpers / "standing_render.py"), "--",
                                  str(args.package), str(args.fit), str(render), "--frame", str(args.frame)], check=True)
    with np.load(posed) as pose:
        screen = pose["xyz"].copy()
        screen[:, :, 0] = width * (pose["xyz"][:, :, 0] / registrations["widthMeters"] + registrations["centerX"]) - .5
        screen[:, :, 1] = height * (registrations["soleY"] - pose["xyz"][:, :, 2] / registrations["heightMeters"]) - .5
        screen[:, :, 2] = -pose["xyz"][:, :, 1]
        raster = rasterizer(temp, args.compiler)
        identity, _, depth = raster(screen, width, height)
        actual = np.where(identity < 0, 0, pose["cls"][identity]).astype("uint8")
        with Image.open(render) as original:
            if original.mode != "RGBA" or abs(original.width / original.height - width / height) > .003:
                raise ValueError("Supply the RGBA orthographic Idle render with the registered photo aspect ratio.")
            baseline = cv2.resize(np.asarray(original.convert("RGB")), (width, height), interpolation=cv2.INTER_CUBIC)
            alpha = cv2.resize(np.asarray(original.getchannel("A")), (width, height), interpolation=cv2.INTER_LINEAR)
        projected = actual > 0
        overlap = (alpha[projected] > 64).mean() if projected.any() else 0.0
        if overlap < .95:
            raise ValueError(f"The rendered character and projected cloth disagree ({overlap:.1%} mask overlap).")
        if args.garment_mask:
            source = np.asarray(Image.open(args.garment_mask))
            if source.ndim != 2 or source.shape != actual.shape or source.max() > 4:
                raise ValueError("Use a single-channel categorical garment mask at the casting photo dimensions.")
        else:
            source = ida_mask(photo, actual, args.segmenter)
        residual, supports = photo_residual(photo, baseline, actual, source, round(registrations["centerX"] * width))
        corrected, changed = atlas_projection(runtime, native, screen, pose["uv"], pose["normal"], pose["cls"],
                                               depth, actual, residual, raster)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=args.output.parent, suffix=".png", delete=False) as output:
        temporary = Path(output.name)
    try:
        Image.fromarray(corrected).save(temporary, format="PNG", compress_level=6)
        temporary.replace(args.output)
    finally:
        temporary.unlink(missing_ok=True)
    return {
        "residentId": fit.get("residentId"), "referenceSha256": photo_hash,
        "registrationSha256": digest(args.fit), "gameplayPackageSha256": digest(args.package),
        "scanPackageSha256": digest(args.scan), "untouchedScanBaseColorSha256": native_digest,
        "baselineGameplayBaseColorSha256": runtime_digest, "renderSha256": digest(render),
        "maskSourceSha256": digest(args.garment_mask or args.segmenter),
        "outputSha256": digest(args.output), "dimensions": list(corrected.shape[1::-1]),
        "originalMeanScanToGameplayRgbError": round(drift, 3), "renderMaskOverlap": round(float(overlap), 5),
        "changedGameplayTexels": changed, "changedScanTexels": int(np.any(corrected != native, axis=2).sum()),
        "supportedPhotoPixels": supports, "pose": {"action": "Idle", "frame": args.frame},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ["package", "scan", "reference", "fit", "output"]:
        parser.add_argument(key, type=Path)
    parser.add_argument("--blender", default=shutil.which("blender") or "blender")
    parser.add_argument("--compiler", default=shutil.which("c++") or "c++")
    mask = parser.add_mutually_exclusive_group(required=True)
    mask.add_argument("--segmenter", type=Path, help="Multiclass selfie segmentation TFLite for Ida's workwear palette")
    mask.add_argument("--garment-mask", type=Path, help="Artist-labelled reference PNG, 0 background/skin, 1 jacket, 2 tee, 3 jeans, 4 shoes")
    parser.add_argument("--baseline", type=Path, help="Previously rendered uncorrected game Idle at --frame")
    parser.add_argument("--standing-renderer", type=Path, help="Location of the project standing_render.py if in another folder")
    parser.add_argument("--material", default="Ida's scanned workwear", help="Material name on the gameplay package")
    parser.add_argument("--scan-material", help="Original scan base-colour material name, required for multi-material donors")
    parser.add_argument("--frame", default=13, type=int)
    parser.add_argument("--report", type=Path, help="Output JSON with source lineage and visibility checks")
    args = parser.parse_args()
    if args.output.suffix.lower() != ".png":
        raise ValueError("Write a lossless PNG for the editable master.")
    if args.output.resolve() in {p.resolve() for p in [args.reference, args.fit, args.scan, args.package,
                                                       args.baseline, args.garment_mask] if p is not None}:
        raise ValueError("The albedo must be a separate output path.")
    cv2.setNumThreads(2)
    with tempfile.TemporaryDirectory(prefix="photographed-workwear-") as work:
        result = bake(args, Path(work))
    contents = json.dumps(result, indent=2) + "\n"
    if args.report:
        args.report.write_text(contents)
    print(contents)


if __name__ == "__main__":
    main()
