"""Match eye scale and camera crop for an honest casting-photograph comparison."""

import argparse
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def review(folder, model_dir):
    casting = np.asarray(Image.open(folder / "reference.jpg").convert("RGB"))
    render = np.asarray(Image.open(folder / "casting-front.jpg").convert("RGB"))
    source = np.fromfile(folder / "face-sculpt.bin", dtype="<f4").reshape(468, 3)[
        :, :2
    ] * [casting.shape[1], casting.shape[0]]
    vision = mp.tasks.vision
    options = vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(model_dir / "face_landmarker.task")
        )
    )
    with vision.FaceLandmarker.create_from_options(options) as detector:
        found = detector.detect(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=render)
        ).face_landmarks
    if len(found) != 1:
        raise ValueError("A single unobstructed face is required in the casting render")
    target = np.array(
        [(p.x * render.shape[1], p.y * render.shape[0]) for p in found[0][:468]]
    )
    pair = np.array([33, 263])
    a, b = source[pair]
    c, d = target[pair]
    ratio = np.linalg.norm(d - c) / np.linalg.norm(b - a)
    theta = np.arctan2(*(b - a)[::-1]) - np.arctan2(*(d - c)[::-1])
    warp = cv2.getRotationMatrix2D(((a + b) * 0.5).tolist(), np.degrees(theta), ratio)
    warp[:, 2] += (c + d) * 0.5 - (a + b) * 0.5
    original = cv2.warpAffine(
        casting,
        warp,
        (render.shape[1], render.shape[0]),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    # Both views retain their own lighting and colour.
    result = Image.new("RGB", (render.shape[1] * 2, render.shape[0] + 28), (32, 32, 32))
    result.paste(Image.fromarray(original), (0, 28))
    result.paste(Image.fromarray(render), (render.shape[1], 28))
    draw = ImageDraw.Draw(result)
    draw.text((12, 7), "Original casting photograph", fill="white")
    draw.text((render.shape[1] + 12, 7), "Neutral Blender render", fill="white")
    result.save(folder / "likeness-review.jpg", quality=94)


if __name__ == "__main__":
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("resident")
    args.add_argument("models", type=Path)
    p = args.parse_args()
    review(ROOT / "Residents" / p.resident, p.models)
