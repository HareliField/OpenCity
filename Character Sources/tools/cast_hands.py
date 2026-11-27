"""Register visible fingertips to the clothed full-length portrait; keep covered hands anatomical."""

from functools import lru_cache
import json
import cv2
import numpy as np
from PIL import Image
import mediapipe as mp


@lru_cache(1)
def detector(path):
    return mp.tasks.vision.HandLandmarker.create_from_options(
        mp.tasks.vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(path)),
            num_hands=1,
            min_hand_detection_confidence=0.25,
            min_hand_presence_confidence=0.35,
        )
    )


def measure_hands(folder, fit, model):
    target = folder / "hand-fit.json"
    if target.exists():
        cached = json.loads(target.read_text())
        if cached.get("reference") == fit["referenceSha256"]:
            return cached["sides"]
    p = np.asarray(Image.open(folder / "reference.jpg").convert("RGB"))
    h, w = p.shape[:2]
    anchors = fit["bodyAnchors"]
    hands = {}
    for i, side in enumerate(["l", "r"]):
        if str(15 + i) not in anchors:
            continue
        wrist = np.asarray(anchors[str(15 + i)]) * [w, h]
        elbow = np.asarray(anchors.get(str(13 + i), anchors[str(15 + i)])) * [w, h]
        forearm = np.linalg.norm(wrist - elbow)
        if forearm < 8:
            continue
        radius = max(18, int(forearm * 0.66))
        center = wrist + (wrist - elbow) * 0.26
        x0, y0 = np.maximum(0, np.floor(center - radius).astype(int))
        x1, y1 = np.minimum([w, h], np.ceil(center + radius).astype(int))
        if x1 <= x0 + 6 or y1 <= y0 + 6:
            continue
        frame = cv2.resize(p[y0:y1, x0:x1], (256, 256), interpolation=cv2.INTER_CUBIC)
        result = detector(model).detect(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)
        )
        if not result.hand_landmarks:
            continue
        observed = np.array(
            [
                [k.x * (x1 - x0) + x0, k.y * (y1 - y0) + y0, k.z * (x1 - x0)]
                for k in result.hand_landmarks[0]
            ]
        )
        length = np.linalg.norm(observed[12, :2] - observed[0, :2])
        if (
            np.linalg.norm(observed[0, :2] - wrist) > 0.45 * forearm
            or not 0.16 * forearm < length < 1.1 * forearm
        ):
            continue
        hands[side] = np.round(observed / [w, h, w], 6).tolist()
    temp = target.with_suffix(".json.pending")
    temp.write_text(
        json.dumps(
            {"reference": fit["referenceSha256"], "sides": hands}, separators=(",", ":")
        )
    )
    temp.replace(target)
    return hands
