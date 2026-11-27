"""Measure hair coverage and strand direction in the resident's frontal casting photo."""

import argparse, json
from pathlib import Path
import cv2
import mediapipe as mp
import numpy as np
from PIL import Image
from fit_photo import ROOT


def guide(folder, model_dir):
    img = np.array(Image.open(folder / "reference.jpg").convert("RGB"))
    h, w = img.shape[:2]
    anchors = json.loads((folder / "photo-fit.json").read_text())["faceAnchors"]
    eyes = np.array([anchors["33"], anchors["263"]]) * [w, h]
    center = eyes.mean(axis=0)
    span = np.linalg.norm(eyes[1] - eyes[0])
    x0 = max(0, int(center[0] - span * 1.32))
    x1 = min(w, int(center[0] + span * 1.32))
    y0 = max(0, int(center[1] - span * 1.66))
    y1 = min(h, int(center[1] + span * 1.58))
    head = img[y0:y1, x0:x1].copy()
    vision = mp.tasks.vision
    opt = vision.ImageSegmenterOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(model_dir / "hair.tflite")
        ),
        output_category_mask=True,
        output_confidence_masks=False,
    )
    with vision.ImageSegmenter.create_from_options(opt) as seg:
        pred = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=head))
        mask = (np.squeeze(pred.category_mask.numpy_view()) == 1).astype(np.uint8)
    gray = cv2.cvtColor(head, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1)
    xx = cv2.GaussianBlur(gx * gx, (7, 7), 1.8)
    yy = cv2.GaussianBlur(gy * gy, (7, 7), 1.8)
    xy = cv2.GaussianBlur(gx * gy, (7, 7), 1.8)
    theta = 0.5 * np.arctan2(2 * xy, xx - yy) + np.pi * 0.5
    np.savez_compressed(
        folder / "groom-guide.npz",
        mask=mask,
        angle=theta.astype("<f2"),
        tone=gray.astype("<f2"),
        eyes=(center - [x0, y0]).astype("f"),
        span=np.float32(span),
    )


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("resident")
    p.add_argument("models", type=Path)
    a = p.parse_args()
    guide(ROOT / "Residents" / a.resident, a.models)
