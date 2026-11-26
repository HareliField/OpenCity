"""Estimate the diffuse-colour correction once from a posed sculpt under the casting lights."""

import argparse
from pathlib import Path
import cv2
import mediapipe as mp
import numpy as np
from PIL import Image
from capture_groom import raster

ROOT = Path(__file__).resolve().parents[1]


def calibrate(folder, model_dir):
    source = np.asarray(Image.open(folder / "reference.jpg").convert("RGB"))
    render = np.asarray(Image.open(folder / "casting-front.jpg").convert("RGB"))
    detail = Image.open(folder / "skin-reference.jpg")
    source_marks = (
        np.fromfile(folder / "face-sculpt.bin", "<f4").reshape(468, 3)[:, :2]
        * source.shape[1::-1]
    )
    uv = np.fromfile(folder / "skin-uv.bin", "<f4").reshape(468, 2)
    vision = mp.tasks.vision
    opts = vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(model_dir / "face_landmarker.task")
        )
    )
    with vision.FaceLandmarker.create_from_options(opts) as detector:
        found = detector.detect(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=render)
        ).face_landmarks
    if len(found) != 1:
        raise ValueError(
            "Skin calibration needs the frontal studio render with the eyes visible."
        )
    seen = np.asarray(
        [(v.x * render.shape[1], v.y * render.shape[0]) for v in found[0][:468]]
    )
    triangles = np.asarray(
        [
            [int(i.split("/")[0]) - 1 for i in row.split()[1:]]
            for row in (ROOT / "Anatomy/face-topology.obj").read_text().splitlines()
            if row.startswith("f ")
        ]
    )
    width, height = np.rint(np.asarray(detail.size) / 6).astype(int)
    x, y, tri, bary = raster(
        uv * [width, height], triangles, np.zeros(468), height, width
    )

    def read(im, marks):
        positions = (marks[tri] * bary[:, :, None]).sum(1).astype("f")
        return (
            cv2.remap(im, positions.reshape(-1, 1, 2), None, cv2.INTER_CUBIC)
            .reshape(-1, 3)
            .astype("f")
        )

    a = read(source, source_marks)
    b = read(render, seen)
    weights = np.ones((len(x), 1), "f")
    g = np.load(folder / "groom-guide.npz")
    origin = (source_marks[33] + source_marks[263]) * 0.5 - g["eyes"]
    on_hair = cv2.remap(
        g["mask"].astype("f"),
        ((source_marks[tri] * bary[:, :, None]).sum(1) - origin)
        .astype("f")
        .reshape(-1, 1, 2),
        None,
        cv2.INTER_LINEAR,
    ).ravel()
    weights[:, 0] = 1 - on_hair
    # Work in approximate linear radiance. Low-pass the gain field so geometry and
    # sub-pixel changes at eyelids do not turn into duplicated painted wrinkles.
    log = np.log((a + 12) / (b + 12)) * 2.15
    log = np.clip(log, -0.40, 0.40)
    gain = np.zeros((height, width, 3), "f")
    mask = np.zeros((height, width), "f")
    gain[y, x] = log * weights
    mask[y, x] = weights.ravel()
    gain = cv2.GaussianBlur(gain, (0, 0), 2.8) / np.maximum(
        0.05, cv2.GaussianBlur(mask, (0, 0), 2.8)[:, :, None]
    )
    gain *= cv2.GaussianBlur(mask, (0, 0), 1.6)[:, :, None]
    packed = np.uint8(np.clip(128 + gain * 267, 0, 255))
    Image.fromarray(packed).save(folder / "skin-calibration.png")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("resident")
    p.add_argument("models", type=Path)
    a = p.parse_args()
    calibrate(ROOT / "Residents" / a.resident, a.models)
