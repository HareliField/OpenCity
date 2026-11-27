"""Register the high-resolution neutral skin plate to the measured facial topology."""

import argparse
from pathlib import Path
import mediapipe as mp
import numpy as np
from PIL import Image
from fit_photo import ROOT


def register(folder, models):
    img = np.array(Image.open(folder / "skin-reference.jpg").convert("RGB"))
    vision = mp.tasks.vision
    options = vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(models / "face_landmarker.task")
        )
    )
    with vision.FaceLandmarker.create_from_options(options) as detector:
        faces = detector.detect(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=img)
        ).face_landmarks
        if len(faces) != 1:
            raise ValueError("Skin reference needs a single unobstructed face")
        points = np.array([(p.x, p.y) for p in faces[0][:468]], dtype="<f4")
        (folder / "skin-uv.bin").write_bytes(points.tobytes())


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("resident")
    p.add_argument("models", type=Path)
    a = p.parse_args()
    register(ROOT / "Residents" / a.resident, a.models)
