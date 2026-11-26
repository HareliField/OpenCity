"""Prepare a resident's hair, skin and woven cloth PBR maps once per set of reference inputs."""

from pathlib import Path
import hashlib
import json
import sys
from face_warp import FACE_OVAL
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GARMENTS = {
    "jacket": ("windbreaker", (128, 46, 52), 0.51),
    "jeans": ("denim", (43, 46, 54), 0.83),
    "tshirt": ("jersey", (105, 104, 101), 0.75),
}


def save(path, pixels, quality=94):
    image = Image.fromarray(np.uint8(np.clip(pixels, 0, 255)))
    image.save(path, quality=quality)


def normal(height, original=None, strength=1):
    dx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3) * strength
    dy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3) * strength
    surface = np.stack((-dx, dy, np.ones_like(dx)), axis=-1)
    if original is not None:
        surface[:, :, :2] += (original[:, :, :2].astype("f") / 127.5 - 1) * 1.15
    return (
        surface / np.maximum(0.01, np.linalg.norm(surface, axis=2)[:, :, None]) + 1
    ) * 127.5


def fabric(folder, garment, name, dye, roughness):
    base = ROOT / "Anatomy" / "Textures"
    luma = (
        np.asarray(
            Image.open(next(base.glob("cloth_" + garment + "_albedo-*"))).convert("L"),
            dtype="f",
        )
        / 255
    )
    original = np.asarray(
        Image.open(next(base.glob("cloth_" + garment + "_normal-*")))
        .convert("RGB")
        .resize((luma.shape[1], luma.shape[0]))
    )
    v, u = np.indices(luma.shape)
    rng = np.random.default_rng(
        int(hashlib.sha256((folder.name + garment).encode()).hexdigest()[:8], 16)
    )
    warp = np.cos((u + v * 0.14) * 2.63)
    weft = np.cos((v - u * 0.04) * 2.22)
    grain = rng.standard_normal(luma.shape).astype("f")
    nap = (warp * 0.45 + weft * 0.35 + grain * 0.20).astype("f")
    seams = np.clip((luma - cv2.GaussianBlur(luma, (0, 0), 2.1)) * 4, -0.45, 0.45)
    fade = cv2.GaussianBlur(grain, (0, 0), 8) * 0.25
    tone = np.clip(luma / 0.755, 0.03, 1.38) ** 1.48
    if garment == "tshirt":
        tone = 0.93 + 0.12 * (tone - 1) + 0.018 * nap
        seams = seams * 0.12
    pigment = np.array(dye)[None, None, :] * tone[:, :, None]
    pigment += (nap * 1.8 + np.maximum(seams, 0) * 13 + fade * 16)[:, :, None]
    # Cloth albedo includes stitch wear, separate normal and roughness describe the weave.
    height = nap * 0.023 + seams * 0.07
    save(folder / (name + "-albedo.jpg"), pigment)
    save(folder / (name + "-normal.png"), normal(height, original))
    save(
        folder / (name + "-roughness.png"),
        (roughness + nap * 0.035 - seams * 0.12) * 255,
    )


def register_casting_face(folder, detail, marks):
    # Restore the features and expression of the original full-length casting photo.
    # The close-up contributes the spatial frequencies above its lower-resolution limit.
    reference = (
        np.asarray(Image.open(folder / "reference.jpg").convert("RGB"), dtype="f") / 255
    )
    h, w = detail.shape[:2]
    rh, rw = reference.shape[:2]
    src = np.fromfile(folder / "face-sculpt.bin", dtype="<f4").reshape(468, 3)[
        :, :2
    ] * [rw, rh]
    dst = marks * np.array([w, h])
    mx = np.full((h, w), -1, dtype="f")
    my = mx.copy()
    for row in (ROOT / "Anatomy" / "face-topology.obj").read_text().splitlines():
        if not row.startswith("f "):
            continue
        ids = [int(v.split("/")[0]) - 1 for v in row.split()[1:]]
        p = dst[ids]
        x0, y0 = np.maximum(0, np.floor(p.min(axis=0)).astype(int))
        x1, y1 = np.minimum([w, h], np.ceil(p.max(axis=0)).astype(int) + 1)
        if x1 <= x0 or y1 <= y0:
            continue
        ix, iy = np.meshgrid(np.arange(x0, x1), np.arange(y0, y1))
        coords = np.stack([ix, iy], axis=-1)
        transform = cv2.getAffineTransform(p.astype("f"), src[ids].astype("f"))
        mapping = coords @ transform[:, :2].T + transform[:, 2]
        mask = np.zeros((y1 - y0, x1 - x0), dtype="uint8")
        cv2.fillConvexPoly(mask, np.round(p - [x0, y0]).astype("int32"), 1)
        for k, output in enumerate((mx, my)):
            view = output[y0:y1, x0:x1]
            view[mask > 0] = mapping[:, :, k][mask > 0]
    lifted = cv2.remap(
        reference, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )
    g = np.load(folder / "groom-guide.npz")
    eyes = (src[33] + src[263]) * 0.5
    offset = np.rint(eyes - g["eyes"])
    hair = cv2.remap(
        g["mask"].astype("f"),
        (mx - offset[0]).astype("f"),
        (my - offset[1]).astype("f"),
        cv2.INTER_LINEAR,
    )
    weight = cv2.GaussianBlur(((mx >= 0) * (1 - hair)).astype("f"), (0, 0), 2)
    base = cv2.GaussianBlur(detail, (0, 0), 3.5)
    corrected = lifted + 0.88 * (detail - base)
    return np.clip(detail + (corrected - detail) * weight[:, :, None] * 0.70, 0, 1)


def skin(folder):
    photo = (
        np.array(Image.open(folder / "skin-reference.jpg").convert("RGB"), dtype="f")
        / 255
    )
    marks = np.fromfile(folder / "skin-uv.bin", dtype="<f4").reshape(468, 2)
    photo = register_casting_face(folder, photo, marks)
    gray = cv2.cvtColor(photo, cv2.COLOR_RGB2GRAY)
    pores = gray - cv2.GaussianBlur(gray, (0, 0), 1.3)
    fine = gray - cv2.GaussianBlur(gray, (0, 0), 4.0)
    # Preserve age lines and pores while leaving room for the scene lights.
    albedo = np.clip(
        (photo * (0.89, np.float32(0.85), 0.83) + pores[:, :, None] * 0.25) * 255,
        0,
        255,
    )
    save(folder / "skin-albedo.jpg", albedo)
    save(folder / "skin-normal.png", normal(pores * 0.17 + fine * 0.07))
    marks = np.fromfile(folder / "skin-uv.bin", dtype="<f4").reshape(468, 2)
    from fit_photo import face_texture

    face_texture(
        folder / "skin-albedo.jpg",
        {"faceAnchors": {str(i): uv for i, uv in enumerate(marks)}},
    )
    h, w = gray.shape
    polygon = np.round(marks[FACE_OVAL] * [w, h]).astype("int32")
    area = np.zeros((h, w), dtype="uint8")
    cv2.fillPoly(area, [polygon], 255)
    dist = cv2.distanceTransform(area, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    fade = np.clip((dist - 6) / 42, 0, 1)
    save(folder / "skin-opacity.png", fade * fade * (3 - 2 * fade) * 255)
    y, x = np.indices(gray.shape)
    nose = marks[1] * [w, h]
    span = (marks[263, 0] - marks[33, 0]) * w
    tzone = np.exp(
        -(((x - nose[0]) / (span * 0.22)) ** 2) - ((y - nose[1]) / (span * 0.43)) ** 2
    )
    save(
        folder / "skin-roughness.png",
        np.clip(0.51 - 0.13 * tzone + 0.15 * fine, 0.31, 0.67) * 255,
    )


def hair(folder):
    # Project this measured frontal matte over a curved, fitted scalp surface.
    g = np.load(folder / "groom-guide.npz")
    fit = json.loads((folder / "photo-fit.json").read_text())
    eyes = (
        (np.array(fit["faceAnchors"]["33"]) + fit["faceAnchors"]["263"])
        * 0.5
        * fit["sourcePixels"]
    )
    origin = np.rint(eyes - g["eyes"]).astype(int)
    mask = g["mask"]
    h, w = mask.shape
    reference = Image.open(folder / "reference.jpg").convert("RGB")
    crop = np.array(reference.crop((*origin, *(origin + [w, h])))).astype("f")
    alpha = cv2.GaussianBlur(mask.astype("f"), (0, 0), 0.47)
    # A continuous scalp texture joins the photographed fringe to the combed side
    # and back. Alpha follows individual frontal locks and softens at the nape.
    from hair_shape import shell

    hh, ww = 768, 1536
    vv, uu = np.indices((hh, ww))
    t = vv / (hh - 1)
    angle = (uu / (ww - 1) - 0.5) * 2 * np.pi
    xx, _, zz = shell(angle, t, 1)
    uu_photo = (g["eyes"][0] + xx * g["span"]).astype("f")
    vv_photo = (g["eyes"][1] - zz * g["span"]).astype("f")
    front = cv2.remap(
        crop, uu_photo, vv_photo, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE
    )
    front_alpha = cv2.remap(
        alpha, uu_photo, vv_photo, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE
    )
    # Use a swatch of real upper scalp colour and local variation from the close-up.
    portrait = np.asarray(Image.open(folder / "skin-reference.jpg").convert("RGB"))
    sh, sw = portrait.shape[:2]
    swatch = portrait[
        int(sh * 0.045) : int(sh * 0.115), int(sw * 0.48) : int(sw * 0.62)
    ]
    patch = swatch.astype("f") - cv2.GaussianBlur(swatch.astype("f"), (0, 0), 3)
    patch = cv2.resize(patch, (192, 192))
    reflected = np.concatenate([patch, patch[:, ::-1]], axis=1)
    tile = np.concatenate([reflected, reflected[::-1]], axis=0)
    texture = (
        np.tile(tile, (hh // tile.shape[0] + 1, ww // tile.shape[1] + 1, 1))[:hh, :ww]
        * 0.48
    )
    texture += np.array([73, 56, 47])
    # Integer strand frequencies meet at the rear UV meridian. Their paths
    # comb toward the nape, avoiding a seam or broad rings under the bun.
    flow = (
        angle + 0.65 * np.sin(angle) * (t - 0.35) + 0.09 * np.sin(2 * angle - 2.7 * t)
    )
    for freq, amp in (
        (43, 2.6),
        (71, 2.0),
        (153, 3.8),
        (227, 4.2),
        (383, 2.6),
        (611, 1.8),
    ):
        texture += (amp * np.cos(flow * freq + 0.4 * np.sin(angle * 4 + t * 11)))[
            :, :, None
        ]
    texture += (8 * np.maximum(0, np.cos(flow * 117 + 1.1)) ** 30)[:, :, None]
    # Composite the plate on the anterior hemisphere. At the pole the radial
    # parametrisation converges, so a narrow band uses a common root tone.
    mix = np.clip((np.cos(angle) - 0.08) / 0.45, 0, 1) * np.clip(
        (t - 0.02) / 0.11, 0, 1
    )
    mix = mix * mix * (3 - 2 * mix)
    painted = (
        texture * (1 - mix[:, :, None])
        + front * np.array([0.91, 0.86, 0.82]) * mix[:, :, None]
    )
    nape = np.clip((1 - t) / 0.047, 0, 1)
    edge = 0.018 * np.sin(flow * 233) + 0.011 * np.cos(flow * 457)
    taper = np.clip((1 - t + edge) / 0.074, 0, 1)
    opacity = ((1 - mix) * nape + mix * front_alpha) * taper
    save(folder / "combed-hair.png", np.dstack((painted, opacity * 255)))
    # Eight coherent bundles. Each tapered fibre is drawn into both RGB and coverage.
    h, w = 768, 1024
    colour = np.empty((h, w, 3), dtype="uint8")
    colour[:] = [61, 45, 37]
    alpha = np.zeros((h, w), dtype="uint8")
    rng = np.random.default_rng(17019)
    t = np.linspace(0, 1, 98)
    for strip in range(8):
        for strand in range(170):
            offset = rng.normal(0, 21)
            phase = rng.uniform(0, 6)
            split = rng.normal(0, 5)
            x = (
                strip * 128
                + 64
                + offset * (0.64 + 0.36 * np.sin(t * np.pi))
                + (4 + split) * np.sin(t * 4 + phase)
                + t**3 * split
            )
            stop = rng.uniform(0.78, 1)
            yy = (0.02 + t * stop) * (h - 1)
            xs = x.astype("i")
            yy = yy.astype("i")
            pts = np.column_stack((xs, yy)).astype("i")
            f = np.clip(rng.normal(0.9, 0.23), 0.3, 1.65)
            c = np.array([90, 70, 59]) if strand % 27 else np.array([156, 143, 130])
            for k in range(0, len(pts) - 1, 8):
                v = np.clip(
                    c * f * (0.86 + 0.23 * np.sin(k / len(pts) * 4 + phase)), 0, 255
                ).astype("i")
                cv2.polylines(
                    colour, [pts[k : k + 9]], False, tuple(map(int, v)), 1, cv2.LINE_AA
                )
                cv2.polylines(
                    alpha,
                    [pts[k : k + 9]],
                    False,
                    int(235 * (1 - 0.54 * (k / len(pts)) ** 6)),
                    1,
                    cv2.LINE_AA,
                )
    save(folder / "hair-fibres.png", np.dstack([colour, alpha]))


def build(folder):
    fit = json.loads((folder / "photo-fit.json").read_text())
    for garment, (name, fallback, roughness) in GARMENTS.items():
        dye = fit["colours"].get(
            {"jacket": "Top", "jeans": "Trousers", "tshirt": "Undershirt"}[garment]
        )
        rgb = tuple(bytes.fromhex(dye.lstrip("#"))) if dye else fallback
        fabric(folder, garment, name, rgb, roughness)
    skin(folder)
    hair(folder)


if __name__ == "__main__":
    build(ROOT / "Residents" / sys.argv[1])
