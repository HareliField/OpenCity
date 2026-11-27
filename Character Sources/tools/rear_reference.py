"""Register an art-directed rear casting photograph to the garment rest space."""

import argparse, json, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
import mediapipe as mp
from fit_photo import wardrobe_texture, ROOT


def build(folder, models):
    direction = json.loads((folder / "art-direction.json").read_text())
    frame = Image.open(folder / "turnaround-reference.jpg").convert("RGB")
    w, h = frame.size
    lo, hi = direction["rearPanel"]
    panel = frame.crop((round(lo * w), 0, round(hi * w), h))
    vision = mp.tasks.vision
    base = mp.tasks.BaseOptions
    with (
        vision.PoseLandmarker.create_from_options(
            vision.PoseLandmarkerOptions(
                base_options=base(model_asset_path=str(models / "pose_landmarker.task"))
            )
        ) as pose,
        vision.ImageSegmenter.create_from_options(
            vision.ImageSegmenterOptions(
                base_options=base(model_asset_path=str(models / "hair.tflite")),
                output_category_mask=True,
                output_confidence_masks=False,
            )
        ) as segment,
    ):
        points = pose.detect(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(panel))
        ).pose_landmarks[0]
        land = {str(i): [p.x, p.y] for i, p in enumerate(points) if p.visibility > 0.35}
        # The left shoulder is on the left side of a rear photograph.
        if land["11"][0] > land["12"][0]:
            for a, b in [
                (11, 12),
                (13, 14),
                (15, 16),
                (23, 24),
                (25, 26),
                (27, 28),
                (31, 32),
            ]:
                land[str(a)], land[str(b)] = land[str(b)], land[str(a)]
        with tempfile.TemporaryDirectory() as tmp:
            temp = Path(tmp)
            im = temp / "back.jpg"
            panel.save(im, quality=95)
            wardrobe_texture(im, {"bodyAnchors": land}, segment)
            for n in ("colour.jpg", "mask.png"):
                (folder / ("rear-" + n)).write_bytes(
                    (temp / ("wardrobe-" + n)).read_bytes()
                )


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("resident")
    p.add_argument("models", type=Path)
    a = p.parse_args()
    build(ROOT / "Residents" / a.resident, a.models)
