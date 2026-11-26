"""Register a captured 3D head to the frontal portrait and extract its hair volume."""

import argparse
import io
import json
import struct
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def read_capture(path):
    raw = path.read_bytes()
    size = struct.unpack_from("<I", raw, 12)[0]
    document = json.loads(raw[20 : 20 + size])
    binary = memoryview(raw)[28 + size :]
    shape = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}
    dtype = {5126: "<f4", 5123: "<u2", 5125: "<u4"}

    def rows(accessor):
        acc = document["accessors"][accessor]
        view = document["bufferViews"][acc["bufferView"]]
        dt = np.dtype(dtype[acc["componentType"]])
        width = shape[acc["type"]]
        return np.ndarray(
            (acc["count"], width),
            dtype=dt,
            buffer=binary,
            offset=view.get("byteOffset", 0) + acc.get("byteOffset", 0),
            strides=(view.get("byteStride", dt.itemsize * width), dt.itemsize),
        )

    primitive = document["meshes"][0]["primitives"][0]
    attrs = primitive["attributes"]
    material = document["materials"][primitive["material"]]["pbrMetallicRoughness"]
    texture = document["textures"][material["baseColorTexture"]["index"]]
    img = document["images"][texture["source"]]
    view = document["bufferViews"][img["bufferView"]]
    start = view.get("byteOffset", 0)
    atlas = np.asarray(
        Image.open(io.BytesIO(binary[start : start + view["byteLength"]])).convert(
            "RGB"
        )
    )
    return (
        rows(attrs["POSITION"]),
        rows(attrs["NORMAL"]),
        rows(attrs["TEXCOORD_0"]),
        rows(primitive["indices"]).reshape(-1, 3),
        atlas,
    )


def raster(xy, triangles, depth, height, width):
    """Rasterize an orthographic view or texture tile with barycentric coordinates."""
    zbuf = np.full((height, width), -np.inf, "f")
    ids = np.full((height, width), -1, "i")
    coeff = np.zeros((height, width, 2), "f")
    for i, tri in enumerate(triangles):
        p = xy[tri]
        lo = np.maximum(0, np.floor(p.min(0)).astype(int))
        hi = np.minimum([width, height], np.ceil(p.max(0) + 1).astype(int))
        if (lo >= hi).any():
            continue
        a, b = p[1:] - p[0]
        det = a[0] * b[1] - b[0] * a[1]
        if abs(det) < 1.0e-9:
            continue
        yy, xx = np.mgrid[lo[1] : hi[1], lo[0] : hi[0]]
        dx = xx - p[0, 0]
        dy = yy - p[0, 1]
        u = (dx * b[1] - dy * b[0]) / det
        v = (a[0] * dy - a[1] * dx) / det
        wz = depth[tri]
        z = wz[0] + u * (wz[1] - wz[0]) + v * (wz[2] - wz[0])
        keep = (u >= -0.001) & (v >= -0.001) & (u + v <= 1.001) & (z > zbuf[yy, xx])
        y, x = yy[keep], xx[keep]
        ids[y, x] = i
        zbuf[y, x] = z[keep]
        coeff[y, x, 0] = u[keep]
        coeff[y, x, 1] = v[keep]
    y, x = np.nonzero(ids >= 0)
    u, v = coeff[y, x].T
    return x, y, triangles[ids[y, x]], np.stack((1 - u - v, u, v), axis=1)


def sample(image, xy):
    pixels = np.rint(xy).astype(int)
    x, y = np.clip(pixels, 0, np.array(image.shape[1::-1]) - 1).T
    return image[y, x]


def register_head(xyz, uv, tris, texture, model_dir):
    top = xyz[:, 1].max()
    near = tris[xyz[tris, 1].max(1) > top - 0.36]
    side = 512
    scale = side / 0.34
    xy = np.stack(
        (side / 2 + xyz[:, 0] * scale, (top + 0.018 - xyz[:, 1]) * scale), axis=1
    )
    x, y, ids, weights = raster(xy, near, xyz[:, 2], side, side)
    view = np.full((side, side, 3), 165, np.uint8)
    tex_xy = (uv[ids] * weights[:, :, None]).sum(1) * np.array(texture.shape[1::-1])
    view[y, x] = sample(texture, tex_xy)
    v = mp.tasks.vision
    opt = v.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(model_dir / "face_landmarker.task")
        )
    )
    with v.FaceLandmarker.create_from_options(opt) as detect:
        faces = detect.detect(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=view)
        ).face_landmarks
    if len(faces) != 1:
        raise ValueError("Cannot register the captured head to a single frontal face")
    scan = np.array([[m.x * side, m.y * side] for m in faces[0][:468]])
    eyes = (scan[33] + scan[263]) * 0.5
    scan_span = np.linalg.norm(scan[263] - scan[33])
    center = np.array([(eyes[0] - side / 2) / scale, top + 0.018 - eyes[1] / scale])
    span = scan_span / scale
    # Fit the 3D volume in eye-span units. Z is depth relative to the captured eye surface.
    z_eye = []
    for eye in (33, 263):
        close = np.linalg.norm(np.stack((x, y), axis=1) - scan[eye], axis=1) < 3
        z_eye.extend((xyz[ids[close], 2] * weights[close]).sum(1))
    if not z_eye:
        raise ValueError("Captured eyes lie outside the rendered mesh")
    coord = (xyz - [center[0], center[1], float(np.median(z_eye))]) / span
    return coord, near, span


def select_groom(coord, near, guide_xy, texture, uv, g):
    mean = coord[near].mean(1)
    local = guide_xy[near].mean(1)
    rgb = sample(texture, uv[near].mean(1) * texture.shape[1::-1]).astype("f")
    luma = rgb @ [0.30, 0.59, 0.11]
    # Retain the photographed fringe on the front and the captured bun behind the ears.
    # The source scan has no separate groom object, so use its colour and depth as
    # independent evidence at skin/hair boundaries around the ears and collar.
    frontal = mean[:, 2] > -0.54
    # Preserve boundary triangles through extraction. Their opacity will follow the
    # source down to fine roots instead of exposing the edges of individual triangles.
    thick = cv2.dilate(g["mask"].astype("uint8"), np.ones((11, 11), "uint8"))
    guide = sample(thick, local) > 0
    matte = cv2.GaussianBlur(
        cv2.morphologyEx(g["mask"], cv2.MORPH_CLOSE, np.ones((3, 3), "uint8")).astype(
            "f"
        ),
        (0, 0),
        0.65,
    )
    keep = (
        (mean[:, 1] > -0.88)
        & (mean[:, 1] < 1.67)
        & np.where(
            frontal,
            guide | ((mean[:, 1] > 0.33) & (luma < 78)),
            (mean[:, 1] > 0.18) | ((luma < 112) & (rgb[:, 0] - rgb[:, 2] < 49)),
        )
    )
    keep &= ~((mean[:, 1] < -0.17) & (rgb[:, 0] - rgb[:, 1] > 32) & (rgb[:, 1] < 75))
    # The registered frontal fringe sits over the crown. Preserve the real
    # three-dimensional temple locks visible beneath it from a side view.
    temple = (
        (np.abs(mean[:, 0]) > 0.73)
        & (mean[:, 2] < -0.20)
        & (luma < 110)
        & (rgb[:, 0] - rgb[:, 1] < 26)
        & (mean[:, 1] < 0.68)
    )
    source_hair_uv = uv[near[keep]].mean(axis=1).astype("<f4")
    keep &= (coord[near, 2].min(1) < -0.48) | temple
    selected = near[keep]
    return selected, matte, source_hair_uv


def frontal_locks(folder, coord, near, guide_xy, primary, orig_eyes, g, matte):
    # Reconstruct the anterior locks on the measured 3D surface. The scan's
    # separated clumps otherwise show coarse gaps under the soft photographed fringe.
    h, w = matte.shape
    offset = np.rint(orig_eyes - g["eyes"]).astype(int)
    crop = primary[offset[1] : offset[1] + h, offset[0] : offset[0] + w].copy()
    gy, gx = np.mgrid[:h, :w]
    background = np.median(np.concatenate([crop[:, :5], crop[:, -5:]], axis=1), axis=1)[
        :, None, :
    ]
    delta = (background - crop.astype("f")).mean(2)
    exterior = (np.abs(gx - g["eyes"][0]) > 0.73 * g["span"]) | (
        gy < g["eyes"][1] - 1.25 * g["span"]
    )
    halo = cv2.dilate(matte, np.ones((15, 15), "uint8"))
    strands = np.clip((delta - 8) / 60, 0, 1) * halo * exterior
    alpha = np.maximum(matte, strands)
    # The semantic hair mask also picks up pieces of the ears. Keep the actual
    # ears on the head, with the darker locks and flyaways crossing in front.
    lateral = np.abs(gx - g["eyes"][0]) / g["span"]
    below_eye = (gy - g["eyes"][1]) / g["span"]
    ear_zone = (
        np.clip((lateral - 0.66) / 0.14, 0, 1)
        * np.clip((1.09 - lateral) / 0.14, 0, 1)
        * np.clip((below_eye + 0.12) / 0.19, 0, 1)
        * np.clip((0.94 - below_eye) / 0.15, 0, 1)
    )
    red, green, blue = crop.astype("f").transpose(2, 0, 1)
    skin = (
        np.clip((red - green - 21) / 11, 0, 1)
        * np.clip((red - blue - 27) / 13, 0, 1)
        * np.clip((red - 86) / 25, 0, 1)
    )
    alpha *= 1 - ear_zone * skin
    # Remove the grey studio backdrop from the colours of translucent strands.
    straight = (crop - (1 - alpha[:, :, None]) * background) / np.maximum(
        alpha[:, :, None], 0.22
    )
    straight = np.where(exterior[:, :, None], straight, crop)
    # At close range, lay fine fibres along the structure tensor measured in the
    # photograph. Average noise along those paths; the across-strand contrast stays
    # sharp. The coarse colour and shape still come from the original photograph.
    resolution = (w * 4, h * 4)
    colour = cv2.resize(
        straight.astype("f"), resolution, interpolation=cv2.INTER_LANCZOS4
    )
    strength = cv2.resize(alpha, resolution, interpolation=cv2.INTER_CUBIC).clip(0, 1)
    angle = g["angle"].astype("f")
    c = cv2.resize(np.cos(2 * angle), resolution)
    s = cv2.resize(np.sin(2 * angle), resolution)
    theta = 0.5 * np.arctan2(s, c)
    along_x = np.cos(theta)
    along_y = np.sin(theta)
    hy, hx = np.indices(strength.shape, dtype="f")
    noise = np.random.default_rng(17019).normal(size=strength.shape).astype("f")
    fiber = np.zeros_like(noise)
    for distance in range(-10, 11):
        fiber += cv2.remap(
            noise,
            hx + distance * along_x,
            hy + distance * along_y,
            cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REFLECT_101,
        )
    fiber = fiber / 21
    fiber -= cv2.GaussianBlur(fiber, (0, 0), 1.9)
    rendered = np.dstack((colour + (fiber * 11 * strength)[:, :, None], 255 * strength))
    Image.fromarray(np.uint8(np.clip(rendered, 0, 255))).save(
        folder / "frontal-locks.png"
    )
    depths = np.zeros((h, w), "f")
    valid = np.zeros((h, w), "uint8")
    px, py, faces, bary = raster(guide_xy, near, coord[:, 2], h, w)
    depths[py, px] = (coord[faces, 2] * bary).sum(1)
    valid[py, px] = 1
    _, labels = cv2.distanceTransformWithLabels(
        1 - valid, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
    )
    nearest = np.zeros(labels.max() + 1, "f")
    nearest[labels[valid > 0]] = depths[valid > 0]
    # The opaque bulk of the groom follows the scalp. Individual fibres are
    # represented by the texture and outer wisps. Deep cracks between scan
    # triangles must not turn into protruding sheets at a grazing angle.
    filled = cv2.GaussianBlur(nearest[labels], (0, 0), 4.25)
    # Outside the cheek silhouette the nearest scan sample can jump between
    # the ear and the back of the skull. A hanging lock crosses neither surface.
    # Filter its depth along its length, keeping its photographed outline.
    hanging = np.clip((lateral - 0.72) / 0.13, 0, 1) * np.clip(
        (below_eye + 0.06) / 0.32, 0, 1
    )
    strand_depth = cv2.GaussianBlur(filled, (0, 0), sigmaX=3.0, sigmaY=8.0)
    filled = filled * (1 - hanging) + strand_depth * hanging
    # Sample a regular lattice on the capture, and keep only the opaque or
    # partially covered front-facing hair polygons. Its profile has full 3D depth.
    step = 2
    ys, xs = np.mgrid[0:h:step, 0:w:step]
    iy, ix = ys.ravel(), xs.ravel()
    ix_count = xs.shape[1]
    ids_grid = np.arange(xs.size).reshape(xs.shape)
    aa = ids_grid[:-1, :-1].ravel()
    ft = np.vstack(
        [
            np.stack((aa, aa + ix_count, aa + ix_count + 1), 1),
            np.stack((aa, aa + ix_count + 1, aa + 1), 1),
        ]
    )
    keep = cv2.dilate(alpha, np.ones((5, 5), "uint8"))[iy, ix][ft].max(1) > 0.045
    ft = ft[keep]
    fids, remap = np.unique(ft, return_inverse=True)
    front_xyz = np.stack(
        (
            (ix - g["eyes"][0]) / g["span"],
            (g["eyes"][1] - iy) / g["span"],
            filled[iy, ix] + 0.025,
        ),
        axis=1,
    )
    front_uv = np.stack(((ix + 0.5) / w, (iy + 0.5) / h), axis=1)
    return front_xyz[fids], remap.reshape(-1, 3), front_uv[fids]


def bake_groom_atlas(
    folder, selected, coord, normal, uv, texture, orig_xy, guide_xy, primary, matte
):
    # Re-pack just the triangles of the hair into a compact tile. Original UV islands
    # are scattered across the 4K body atlas, most of which belongs to the clothes.
    # Store one small triangular patch per face. Shared geometric vertices on adjacent
    # patches receive the original smooth vertex normals at their UV seams.
    n = len(selected)
    cell = 10
    cols = int(np.ceil(np.sqrt(n / 2)))
    rows = int(np.ceil(n / (2 * cols)))
    width = cols * cell
    height = rows * cell
    atlas = np.zeros((height, width, 4), np.uint8)
    corners = []
    yy, xx = np.mgrid[0:cell, 0:cell]
    for i, tri in enumerate(selected):
        tile = i // 2
        col = tile % cols
        row = tile // cols
        origin = np.array([col * cell, row * cell])
        upper = i % 2 == 0
        # Leave a gutter between two opposing triangle footprints, including for mips.
        p = (
            np.array([[0.5, 0.5], [cell - 2.5, 0.5], [0.5, cell - 2.5]])
            if upper
            else np.array(
                [[cell - 1.5, cell - 1.5], [1.5, cell - 1.5], [cell - 1.5, 1.5]]
            )
        )
        corners.append((p + origin + 0.5) / [width, height])
        a = (xx - p[0, 0]) / (p[1, 0] - p[0, 0])
        b = (yy - p[0, 1]) / (p[2, 1] - p[0, 1])
        inside = xx + yy < cell - 1 if upper else xx + yy >= cell - 1
        w = np.stack([1 - a - b, a, b], axis=-1)
        w = np.maximum(w, 0)
        w /= w.sum(2)[:, :, None]
        tex = (
            sample(texture, (w @ uv[tri] * texture.shape[1::-1]).reshape(-1, 2))
            .reshape(cell, cell, 3)
            .astype("f")
        )
        photo_xy = (w @ orig_xy[tri]).astype("f")
        ref = cv2.remap(
            primary, photo_xy, None, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
        )
        coverage = cv2.remap(
            matte, (w @ guide_xy[tri]).astype("f"), None, cv2.INTER_LINEAR
        )
        facing = np.clip(((w @ normal[tri])[:, :, 2] + 0.18) / 0.48, 0, 1)
        blend = (
            facing * coverage * np.clip(((w @ coord[tri])[:, :, 2] + 0.56) / 0.30, 0, 1)
        )
        painted = tex * (1 - blend[:, :, None]) + ref * blend[:, :, None]
        projected = w @ coord[tri]
        forward = np.clip((projected[:, :, 2] + 0.91) / 0.26, 0, 1)
        # The front and outer temple cutout comes from the photograph. Posterior
        # roots are solid so the bun remains a volume from the opposite view.
        outside = np.clip((np.abs(projected[:, :, 0]) - 0.83) / 0.13, 0, 1) * np.clip(
            (projected[:, :, 2] + 1.24) / 0.3, 0, 1
        )
        profile_edge = np.clip(
            (np.abs(projected[:, :, 0]) - 0.58) / 0.17, 0, 1
        ) * np.clip((0.45 - projected[:, :, 1]) / 0.23, 0, 1)
        follow = np.maximum.reduce((forward, outside, profile_edge))
        frontal_fade = np.clip((projected[:, :, 2] + 0.72) / 0.19, 0, 1)
        lateral_lock = np.clip((np.abs(projected[:, :, 0]) - 0.69) / 0.13, 0, 1)
        lateral_lock *= np.clip((0.72 - projected[:, :, 1]) / 0.17, 0, 1)
        alpha = (1 - follow + follow * coverage) * (
            1 - frontal_fade * (1 - lateral_lock)
        )
        packed = np.dstack((painted, 255 * alpha))
        atlas[row * cell : row * cell + cell, col * cell : col * cell + cell][
            inside
        ] = np.clip(packed[inside], 0, 255)
    Image.fromarray(atlas).save(folder / "captured-hair.png")
    return np.asarray(corners, "<f4")


def bake_jaw_colour(
    folder, model_dir, coord, normal, uv, near, texture, orig_xy, primary
):
    """Transfer visible jaw and throat colour, retaining the scanned profile and rear."""
    v = mp.tasks.vision
    opt = v.ImageSegmenterOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(model_dir / "hair.tflite")
        ),
        output_category_mask=True,
    )
    with v.ImageSegmenter.create_from_options(opt) as segmenter:
        result = segmenter.segment(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=primary)
        )
        classes = result.category_mask.numpy_view().squeeze()
        skin = np.isin(classes, (2, 3)).astype("f")
    skin = cv2.GaussianBlur(cv2.erode(skin, np.ones((5, 5), "uint8")), (0, 0), 2)
    height = coord[near, 1].mean(1)
    jaw = near[(height < 0.35) & (height > -2.5)]
    side = 1024
    atlas = cv2.resize(texture, (side, side), interpolation=cv2.INTER_AREA)
    x, y, ids, weights = raster(uv * side - 0.5, jaw, coord[:, 2], side, side)
    position = (coord[ids] * weights[:, :, None]).sum(1)
    facing = (normal[ids, 2] * weights).sum(1)
    photo_xy = (orig_xy[ids] * weights[:, :, None]).sum(1)
    colour = sample(primary, photo_xy)
    base = atlas[y, x].astype("f")
    r, g, b = base.T
    source_skin = np.clip((r - b - 4) / 14, 0, 1) * np.clip(
        (g / np.maximum(r, 1) - 0.51) / 0.12, 0, 1
    )
    # The category mask can include a gray shirt pixel at the crew-neck seam.
    sr, sg, sb = colour.astype("f").T
    target_skin = np.clip((sr - sb - 7) / 15, 0, 1) * np.clip(
        (sg / np.maximum(sr, 1) - 0.52) / 0.13, 0, 1
    )
    influence = (
        sample(skin, photo_xy)
        * source_skin
        * target_skin
        * np.clip((facing - 0.05) / 0.65, 0, 1)
        * np.clip((position[:, 2] + 1.25) / 0.60, 0, 1)
    )
    # Keep the luminance variations of the reference neck, including its tendons
    # and fine creases. The side and rear use the captured surface's own colour.
    correction = np.zeros(atlas.shape, dtype="f")
    correction[y, x] = (0.91 * influence)[:, None] * (colour - base)
    occupied = np.zeros(atlas.shape[:2], dtype="uint8")
    occupied[y, x] = 1
    distance, labels = cv2.distanceTransformWithLabels(
        1 - occupied, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
    )
    nearest = np.zeros((labels.max() + 1, 3), dtype="f")
    nearest[labels[y, x]] = correction[y, x]
    gutter = (distance > 0) & (distance <= 3)
    correction[gutter] = nearest[labels[gutter]]
    atlas = np.rint(np.clip(atlas + correction, 0, 255)).astype("uint8")
    Image.fromarray(atlas).save(folder / "captured-neck.jpg", quality=96)


def prepare(folder, model_dir, scan):
    xyz, normal, uv, tris, texture = read_capture(folder / scan)
    coord, near, span = register_head(xyz, uv, tris, texture, model_dir)
    g = np.load(folder / "groom-guide.npz")
    guide_xy = g["eyes"] + coord[:, :2] * [g["span"], -g["span"]]
    primary = np.asarray(Image.open(folder / "reference.jpg").convert("RGB"))
    fit = json.loads((folder / "photo-fit.json").read_text())
    orig_eyes = (
        np.mean([fit["faceAnchors"][k] for k in ("33", "263")], axis=0)
        * primary.shape[1::-1]
    )
    orig_xy = orig_eyes + coord[:, :2] * [g["span"], -g["span"]]
    selected, matte, source_hair_uv = select_groom(
        coord, near, guide_xy, texture, uv, g
    )
    unique, rev = np.unique(selected, return_inverse=True)
    triangles = rev.reshape(-1, 3)
    front, front_triangles, front_uv = frontal_locks(
        folder, coord, near, guide_xy, primary, orig_eyes, g, matte
    )
    corners = bake_groom_atlas(
        folder, selected, coord, normal, uv, texture, orig_xy, guide_xy, primary, matte
    )
    bake_jaw_colour(
        folder, model_dir, coord, normal, uv, near, texture, orig_xy, primary
    )
    np.savez_compressed(
        folder / "captured-hair.npz",
        coordinates=coord[unique].astype("<f4"),
        triangles=triangles.astype("<i4"),
        uv=corners,
        normals=normal[unique].astype("<f4"),
        front=front.astype("<f4"),
        front_triangles=front_triangles.astype("<i4"),
        front_uv=front_uv.astype("<f4"),
        sourceHairUV=source_hair_uv,
    )
    print(
        f"{len(unique)} fitted hair vertices, {len(selected)} triangles; captured eye span {span:.4f}m"
    )


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("resident")
    p.add_argument("models", type=Path)
    p.add_argument("scan")
    args = p.parse_args()
    prepare(ROOT / "Residents" / args.resident, args.models, args.scan)
