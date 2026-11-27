"""Cast a fictional resident from registered studio photographs, preserving the subject's written cues."""

import argparse
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import random
import re

import cv2
import numpy as np
from PIL import Image
from design import design, COLOURS
from cast_direction import direction, HAIR, OUTFITS
from face_warp import FACE_OVAL, warp

ROOT = Path(__file__).resolve().parents[1]
METHOD = "Landmark-registered fictional photographic composite"
# Presentation of the original full-length wardrobe plates, recorded at casting.
MASCULINE_PLATES = set(
    "0002 0003 0006 0007 0008 0011 0013 0015 0018 0022 0024 0027 0030 0032 0037 0038 0040 0041 0043 0121 0153 0156 0158 0159 0161 0162 0173 0273 0287 0751 0754 0755 0756 0760 0761 0766 0773 0774 1491 1494 1495 1497 1498 1499".split()
)
WIDTH, HEIGHT = 768, 1152
FEATURES = np.array(
    [
        33,
        133,
        159,
        145,
        263,
        362,
        386,
        374,
        1,
        168,
        98,
        327,
        61,
        291,
        0,
        17,
        234,
        454,
        152,
        10,
        172,
        397,
        127,
        356,
    ]
)


def detector(model_dir):
    import mediapipe as mp

    return mp.tasks.vision.ImageSegmenter.create_from_options(
        mp.tasks.vision.ImageSegmenterOptions(
            base_options=mp.tasks.BaseOptions(
                model_asset_path=str(model_dir / "hair.tflite")
            ),
            output_category_mask=True,
            output_confidence_masks=False,
        )
    )


def as_rgb(colour):
    return np.array([int(colour[i : i + 2], 16) for i in (1, 3, 5)])


def plates():
    found = []
    for p in sorted((ROOT / "Residents").glob("*/reference.jpg")):
        folder = p.parent
        record = folder / "casting.json"
        if record.exists() and json.loads(record.read_text()).get("method") == METHOD:
            continue
        if (
            not (folder / "face-sculpt.bin").is_file()
            or not (folder / "photo-fit.json").exists()
        ):
            continue
        person = json.loads((folder / "persona.json").read_text())
        fit = json.loads((folder / "photo-fit.json").read_text())
        hair, coat = direction(person)
        # Preserve the observed presentation of the source. Unspecified fictional
        # residents receive an art direction, without deriving it from their occupation.
        masculine = folder.name[-4:] in MASCULINE_PLATES
        if (
            record.exists()
            and json.loads(record.read_text()).get("method")
            == "Original generated studio photograph"
        ):
            masculine = fit.get("bodyFrame", 0) > 0.18
        found.append(
            (folder, person["age"], masculine, (hair, coat), fit.get("subjectBounds"))
        )
    if len(found) < 12:
        raise ValueError("Fit the original studio plates before casting new residents.")
    return found


@lru_cache(28)
def plate(folder):
    import mediapipe as mp

    photo = np.asarray(
        Image.open(folder / "reference.jpg")
        .convert("RGB")
        .resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    )
    points = np.fromfile(folder / "face-sculpt.bin", dtype="<f4").reshape(468, 3)[
        :, :2
    ] * [WIDTH, HEIGHT]
    frame = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(photo))
    labels = folder / "subject-mask.png"
    if labels.exists():
        segmentation = np.asarray(
            Image.open(labels).resize((WIDTH, HEIGHT), Image.Resampling.NEAREST)
        )
    else:
        segmentation = (
            segmenter.segment(frame).category_mask.numpy_view().squeeze().copy()
        )
    mask = cv2.GaussianBlur(np.uint8(segmentation == 4) * 255, (7, 7), 1.4)
    hair = cv2.GaussianBlur(np.uint8(segmentation == 1) * 255, (5, 5), 1)
    fit = json.loads((folder / "photo-fit.json").read_text())
    return photo, points, mask, hair, fit, segmentation


def facial_frame(points):
    center = (points[33] + points[263]) / 2
    axis = points[263] - points[33]
    matrix = np.array([axis, [-axis[1], axis[0]]])
    return center, matrix, (points - center) @ np.linalg.inv(matrix)


def sample_patch(photo, points, target, grid, span):
    # A smooth map through both eyelids, nose wings, lip corners and jaw keeps the
    # features registered. Sampling the map on a coarse lattice preserves texture detail.
    small = grid[::3, ::3]
    pixels = warp(
        target[FEATURES] / span, points[FEATURES], small.reshape(-1, 2) / span
    )
    mapping = cv2.resize(
        pixels.reshape(*small.shape[:2], 2).astype("f"),
        None,
        fx=3,
        fy=3,
        interpolation=cv2.INTER_CUBIC,
    )
    mapping = mapping[: grid.shape[0], : grid.shape[1]]
    return cv2.remap(
        photo, mapping, None, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    ).astype("f")


def tint(photo, mask, old, desired, strength):
    # Retain local weave, buttons, highlights and dark folds while replacing the dye.
    old = np.maximum(as_rgb(old), 28)
    ratio = np.clip((np.maximum(as_rgb(desired), 20) / old) ** 0.85, 0.45, 2.15)
    amount = mask.astype("f")[:, :, None] * (strength / 255)
    return np.uint8(np.clip(photo * (1 + (ratio - 1) * amount), 0, 255))


def pick(pool, rng, person, layers, identity):
    narrative = (
        person["life"].split("People around", 1)[0].split("often includes", 1)[0]
    )
    she, he = [
        len(re.findall(r"\b" + word + r"\b", narrative, re.I)) for word in ("she", "he")
    ]
    presentation = he > she if she != he else "gender_male" in identity
    hair, coat = direction(person)
    age = person["age"]
    group = lambda a: 0 if a < 13 else 1 if a < 18 else 2
    eligible = [p for p in pool if group(p[1]) == group(age)]
    if len(eligible) < 4 and age >= 13:
        eligible = [p for p in pool if (13 <= p[1] <= 27 if age < 18 else p[1] >= 18)]
    if len(eligible) < 4:
        raise ValueError("Original casting photographs are needed for this age group")

    def rank(p, part):
        cue = p[3][0 if part == "head" else 1]
        exact = hair if part == "head" else coat
        typ = HAIR if part == "head" else OUTFITS
        mismatch = (18 if cue != exact else 0) + (
            24 if typ[cue][0] != typ[exact][0] else 0
        )
        return (
            abs(age - p[1]) * 0.53
            + (19 if p[2] != presentation else 0)
            + mismatch
            + rng.uniform(0, 24)
        )

    body = min(eligible, key=lambda p: rank(p, "body"))
    head = min(eligible, key=lambda p: rank(p, "head"))
    donors = sorted(
        [p for p in eligible if p[0] not in (body[0], head[0])],
        key=lambda p: (
            abs(p[1] - age) * 0.42
            + (9 if p[2] != presentation else 0)
            + rng.uniform(0, 20)
        ),
    )[:20]
    extras = rng.sample(donors, 3) if len(donors) >= 3 else rng.choices(donors, k=3)
    return [body[0], head[0], *(p[0] for p in extras)]


def fitted_head(body, head):
    """Fit photographed scalp and jaw onto a distinct photographed wardrobe."""
    form, bp, cloth, _, bf, bs = body
    subject, hp, _, _, hf, hs = head
    bmid, baxes, _ = facial_frame(bp)
    hmid, haxes, _ = facial_frame(hp)
    A = np.linalg.solve(haxes, baxes)
    translate = bmid - hmid @ A
    matrix = np.column_stack((A.T, translate))
    remap = lambda im, mode: cv2.warpAffine(
        im, matrix, (WIDTH, HEIGHT), flags=mode, borderMode=cv2.BORDER_REPLICATE
    )
    registered = remap(subject, cv2.INTER_CUBIC)
    labels = remap(hs, cv2.INTER_NEAREST)
    points = hp @ A + translate
    y = np.arange(HEIGHT)[:, None]
    span = np.linalg.norm(baxes[0])
    jaw = points[152, 1]
    end = jaw + span * 0.57
    old_head = (
        np.isin(bs, [1, 3]) | ((bs == 2) & (y < end)) | ((bs == 5) & (y < jaw))
    ) & (y < jaw + 2.6 * span)
    new_head = (
        np.isin(labels, [1, 3])
        | ((labels == 2) & (y < end))
        | ((labels == 5) & (y < jaw))
    ) & (y < jaw + 2.6 * span)
    near_neck = np.clip((end - y) / max(1, span * 0.34), 0, 1)
    alpha = cv2.GaussianBlur(np.uint8(new_head) * 255, (5, 5), 0.75).astype("f") / 255
    alpha *= np.where(labels == 2, near_neck, 1)
    # Retain original exposed neck. Fill the former hair silhouette with sampled
    # studio backdrop; where a lock crossed cloth, extend the neighbouring fabric.
    result = form.copy()
    erase = old_head & ((bs == 1) | (bs == 3) | (bs == 5))
    # Reconstruct the local studio gradient around the complete former hairstyle.
    # Its soft outline extends several pixels outside the segmenter's hard mask.
    extent = cv2.dilate(np.uint8(erase), np.ones((19, 19), "uint8"))
    bottom = min(HEIGHT, int(jaw + 2.8 * span))
    small = cv2.resize(
        form[:bottom], None, fx=0.3, fy=0.3, interpolation=cv2.INTER_AREA
    )
    holes = cv2.resize(
        extent[:bottom], (small.shape[1], small.shape[0]), interpolation=cv2.INTER_AREA
    )
    back = cv2.resize(
        cv2.inpaint(small, holes, 5, cv2.INPAINT_TELEA),
        (WIDTH, bottom),
        interpolation=cv2.INTER_CUBIC,
    )
    edge = cv2.GaussianBlur(extent[:bottom].astype("f"), (9, 9), 1.7)[:, :, None]
    result[:bottom] = np.uint8(form[:bottom] * (1 - edge) + back * edge)
    collar = (
        erase
        & (y > jaw + span * 0.29)
        & (abs(np.arange(WIDTH)[None, :] - bmid[0]) < span * 1.75)
    )
    if np.any(collar):
        _, nearest = cv2.distanceTransformWithLabels(
            np.uint8(bs != 4), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
        )
        colours = np.zeros((nearest.max() + 1, 3), "uint8")
        colours[nearest[bs == 4]] = form[bs == 4]
        result[collar] = colours[nearest[collar]]
    # A common skin value at the collar and hands avoids an exposure/complexion seam.
    delta = as_rgb(hf["colours"]["Skin"]) - as_rgb(bf["colours"]["Skin"])
    keep_skin = cv2.GaussianBlur(np.uint8(bs == 2) * 255, (7, 7), 1.3).astype("f") / 255
    result = np.clip(result + np.clip(delta, -64, 64) * keep_skin[:, :, None], 0, 255)
    result = np.uint8(result * (1 - alpha[:, :, None]) + registered * alpha[:, :, None])
    hair = cv2.GaussianBlur(np.uint8(labels == 1) * 255, (5, 5), 1)
    return result, points, cloth, hair, bf


def render(folder, pool, attempt=0, replace=False):
    dest = folder / "reference.jpg"
    if dest.exists() and not replace:
        return
    person = json.loads((folder / "persona.json").read_text())
    rng = random.Random(
        "portrait-cast-v2/" + folder.name + (f"/{attempt}" if attempt else "")
    )
    layers, colours, identity = design(person)
    chosen = pick(pool, rng, person, layers, identity)
    records = [plate(path) for path in chosen]
    photo, points, mask, hair, fit = fitted_head(records[0], records[1])
    hair_cue, coat_cue = direction(person)
    garment_colour = next(
        (c for key, c in COLOURS.items() if key in coat_cue), colours["Top"]
    )
    colours["Top"] = garment_colour
    head_fit = records[1][4]
    if "Hair" in head_fit["colours"]:
        desired = {
            "white": "#adaaa4",
            "gray": "#817b74",
            "silver": "#8f918c",
            "auburn": "#754432",
            "copper": "#97583e",
            "sandy": "#958066",
            "black": "#3c3330",
            "dark brown": "#44332c",
            "chestnut": "#614133",
        }
        pigment = HAIR[hair_cue][2]
        colours["Hair"] = desired.get(
            pigment,
            colours["Hair"]
            if pigment == "unspecified"
            else head_fit["colours"]["Hair"],
        )
        photo = tint(photo, hair, head_fit["colours"]["Hair"], colours["Hair"], 0.68)
    body = fit.get("bodyAnchors", {})
    hip_y = np.mean([body.get(str(i), [0, 0.51])[1] for i in (23, 24)]) * HEIGHT
    shoulder_y = np.mean([body.get(str(i), [0, 0.22])[1] for i in (11, 12)]) * HEIGHT
    y, x = np.mgrid[:HEIGHT, :WIDTH].astype("f")
    top = np.clip((hip_y + HEIGHT * 0.045 - y) / (HEIGHT * 0.058), 0, 1)
    photo = tint(
        photo, mask * top, fit["colours"].get("Top", "#777777"), colours["Top"], 0.94
    )
    photo = tint(
        photo,
        mask * (1 - top),
        fit["colours"].get("Trousers", "#555555"),
        colours["Trousers"],
        0.66,
    )

    center, axes, native = facial_frame(points)
    aligned = [facial_frame(record[1])[2] for record in records[1:]]
    weights = np.array(
        [
            rng.uniform(0.12, 0.28),
            rng.uniform(0.26, 0.44),
            rng.uniform(0.18, 0.36),
            rng.uniform(0.12, 0.32),
        ]
    )
    target = np.average(aligned, axis=0, weights=weights)
    # Fit the outer edge to the hairline and neck while permitting a different jaw and brow.
    target[FACE_OVAL] = 0.78 * native[FACE_OVAL] + 0.22 * target[FACE_OVAL]
    target[:, 0] *= 1 + rng.uniform(-0.055, 0.055) * np.exp(
        -(((target[:, 1] - 0.35) / 0.63) ** 2)
    )
    target[:, 1] *= rng.uniform(0.96, 1.05)
    goal = target @ axes + center
    lo = np.maximum(np.floor(np.minimum(points.min(0), goal.min(0)) - 7).astype(int), 0)
    hi = np.minimum(
        np.ceil(np.maximum(points.max(0), goal.max(0)) + 8).astype(int), [WIDTH, HEIGHT]
    )
    yy, xx = np.mgrid[lo[1] : hi[1], lo[0] : hi[0]]
    grid = np.stack([xx, yy], axis=-1).astype("f")
    span = np.linalg.norm(axes[0])
    canon = (grid - center) @ np.linalg.inv(axes)
    patch = sample_patch(photo, points, goal, grid, span)
    patches = []
    for donor, marks, _, _, _, _ in records[2:]:
        part = sample_patch(donor, marks, goal, grid, span)
        # Match exposure on the two cheeks so skin tones join under the same studio lights.
        cheek = (
            (abs(canon[:, :, 0]) > 0.23)
            & (abs(canon[:, :, 0]) < 0.53)
            & (canon[:, :, 1] > 0.24)
            & (canon[:, :, 1] < 0.47)
        )
        offset = np.median(patch[cheek], 0) - np.median(part[cheek], 0)
        patches.append(np.clip(part + offset, 0, 255))
    upper = np.clip((0.34 - canon[:, :, 1]) / 0.22, 0, 1)
    lower = np.clip((canon[:, :, 1] - 0.48) / 0.2, 0, 1)
    c = (
        upper[:, :, None] * patches[0]
        + lower[:, :, None] * patches[2]
        + (1 - upper - lower)[:, :, None] * patches[1]
    )
    mix = 0.78 + rng.uniform(-0.07, 0.08)
    mixed = patch * (1 - mix) + c * mix
    matte = np.zeros(grid.shape[:2], np.uint8)
    cv2.fillPoly(matte, [np.int32(goal[FACE_OVAL] - lo)], 255)
    distance = cv2.distanceTransform(matte, cv2.DIST_L2, 5)
    feather = np.clip(distance / (span * 0.135), 0, 1)[:, :, None]
    region = photo[lo[1] : hi[1], lo[0] : hi[0]]
    region[:] = np.uint8(np.clip(region * (1 - feather) + mixed * feather, 0, 255))
    shoulder = rng.uniform(-0.064, 0.092)
    hips = rng.uniform(-0.075, 0.075)
    scale = (
        1
        + shoulder * np.exp(-(((y - shoulder_y) / (0.15 * HEIGHT)) ** 2))
        + hips * np.exp(-(((y - hip_y) / (0.18 * HEIGHT)) ** 2))
    )
    center_x = points[1, 0]
    leg_length = rng.uniform(-0.012, 0.018) * HEIGHT * np.sin(np.pi * y / HEIGHT) ** 2
    finished = cv2.remap(
        photo,
        np.float32(center_x + (x - center_x) / scale),
        np.float32(y + leg_length),
        cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    tmp = dest.with_suffix(".pending")
    Image.fromarray(finished).save(tmp, format="JPEG", quality=92, subsampling=0)
    digest = hashlib.sha256(tmp.read_bytes()).hexdigest()
    receipt = {
        "method": METHOD,
        "version": 2,
        "residentId": folder.name,
        "sources": [p.name for p in chosen],
        "referenceSha256": digest,
        "direction": person["appearance"],
    }
    (folder / "casting.json").write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n"
    )
    tmp.replace(dest)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("model_dir", type=Path)
    p.add_argument("ids", nargs="*")
    p.add_argument("--output-parent", type=Path)
    args = p.parse_args()
    cv2.setNumThreads(1)
    segmenter = detector(args.model_dir)
    pool = plates()
    residents = args.output_parent or ROOT / "Residents"
    folders = (
        [residents / k for k in args.ids]
        if args.ids
        else sorted(residents.glob("AH-R*"))
    )
    for index, folder in enumerate(folders, 1):
        render(folder, pool)
        if index % 50 == 0 or index == len(folders):
            print(f"{index}/{len(folders)} casting pictures ready", flush=True)
