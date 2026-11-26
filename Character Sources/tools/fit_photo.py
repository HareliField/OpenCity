"""Fit a neutral front portrait with MediaPipe and sample its wardrobe palette."""

import argparse
import hashlib
import json
from pathlib import Path
import mediapipe as mp
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def rgbhex(rgb):
    return "#" + "".join(f"{int(np.clip(c, 0, 255)):02x}" for c in rgb)


def fit(path, face_detector, pose_detector, hair_detector):
    image = np.array(Image.open(path).convert("RGB"))
    h, w = image.shape[:2]

    def frame(img):
        return mp.Image(
            image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(img)
        )

    pose = pose_detector.detect(frame(image))
    joints = None
    if pose.pose_landmarks:
        joints = np.array(
            [(p.x * w, p.y * h, p.visibility) for p in pose.pose_landmarks[0]]
        )
    if joints is not None and min(joints[7:9, 2]) > 0.5:
        center = joints[[0, 7, 8], :2].mean(axis=0)
        earspan = np.linalg.norm(joints[7, :2] - joints[8, :2])
        r = max(35, int(earspan * 0.98))
        x = max(0, int(center[0]) - r)
        y = max(0, int(center[1]) - int(r * 1.2))
        crop = image[y : min(h, y + 2 * r + 1), x : min(w, x + 2 * r + 1)]
    else:
        x = w // 6
        y = 0
        crop = image[: h // 2, x : w - x]
    faces = face_detector.detect(frame(crop))
    if not faces.face_landmarks:
        raise ValueError("face landmarks unavailable")
    v = np.array(
        [
            (p.x * crop.shape[1] + x, p.y * crop.shape[0] + y)
            for p in faces.face_landmarks[0]
        ]
    )
    depth = np.array([p.z * crop.shape[1] for p in faces.face_landmarks[0]])
    facial = np.column_stack((v[:468, 0] / w, v[:468, 1] / h, depth[:468] / w)).astype(
        "<f4"
    )
    path.with_name("face-sculpt.bin").write_bytes(facial.tobytes())
    width = np.linalg.norm(v[234] - v[454])

    def distance(a, b):
        return np.linalg.norm(v[a] - v[b]) / width

    def scaled(a, b, center, span):
        return round(float(np.clip((distance(a, b) - center) / span, -0.95, 0.95)), 4)

    def sample(pos, radius):
        x, y = np.round(pos).astype(int)
        r = max(1, int(radius))
        pixels = image[
            max(0, y - r) : min(h, y + r + 1), max(0, x - r) : min(w, x + r + 1)
        ]
        return np.median(pixels.reshape(-1, 3), axis=0)

    eye_line = (v[33] + v[263]) / 2
    targets = {
        "eye_spacing": scaled(133, 362, 0.235, 0.12),
        "eye_size": scaled(33, 133, 0.197, 0.10),
        "mouth_width": scaled(61, 291, 0.36, 0.16),
        "jaw_width": scaled(172, 397, 0.80, 0.18),
        "nose_width": scaled(98, 327, 0.25, 0.12),
        "nose_length": scaled(168, 2, 0.29, 0.12),
        "lips": scaled(0, 17, 0.095, 0.07),
        "chin": scaled(17, 152, 0.235, 0.12),
        "forehead": scaled(10, 168, 0.40, 0.18),
    }
    skin = np.median([sample(v[i], width * 0.024) for i in [123, 352, 50, 280]], axis=0)
    colours = {
        "Skin": rgbhex(skin),
        "Hair": rgbhex(sample(v[10] + (v[10] - eye_line) * 0.35, width * 0.04)),
    }
    record = {
        "referenceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "faceTargets": targets,
        "colours": colours,
        "faceAnchors": {
            str(i): [round(float(v[i, 0] / w), 6), round(float(v[i, 1] / h), 6)]
            for i in (10, 152, 33, 263, 133, 362, 1, 61, 291, 234, 454, 168, 17, 0)
        },
        "sourcePixels": [w, h],
    }
    # Inspect the hair separately from skin and background at portrait scale.
    x0 = max(0, int(v[:, 0].min() - width * 0.63))
    x1 = min(w, int(v[:, 0].max() + width * 0.63))
    y0 = max(0, int(v[:, 1].min() - width * 0.62))
    y1 = min(h, int(v[:, 1].max() + width * 0.72))
    head = image[y0:y1, x0:x1]
    parsed_head = hair_detector.segment(frame(head))
    segmentation = np.squeeze(parsed_head.category_mask.numpy_view())
    hy, hx = np.nonzero(segmentation == 1)
    if len(hy) > 20:
        rgb = np.median(head[hy, hx], axis=0)
        colours["Hair"] = rgbhex(rgb)
        edge_y = np.percentile(hy + y0, 90)
        span = np.quantile(hx, 0.97) - np.quantile(hx, 0.03)
        record["hairProfile"] = {
            "bottomBelowEyes": round(float((edge_y - eye_line[1]) / width), 3),
            "widthInFaces": round(float(span / width), 3),
            "medianRGB": rgbhex(rgb),
        }
    if joints is not None:
        mid_eye = (v[33] + v[263]) * 0.5
        front = (v[1] - mid_eye)[1] / width
        record["faceTargets"]["nose_height"] = round(
            float(np.clip((front - 0.23) * 2.0, -0.7, 0.7)), 4
        )
    if joints is not None and min(joints[[11, 12, 23, 24, 25, 26], 2]) > 0.48:
        shoulder = joints[[11, 12], :2].mean(axis=0)
        hip = joints[[23, 24], :2].mean(axis=0)
        sw = np.linalg.norm(joints[11, :2] - joints[12, :2])
        hw = np.linalg.norm(joints[23, :2] - joints[24, :2])
        torso = np.linalg.norm(shoulder - hip)
        colours["Top"] = rgbhex(
            sample(
                shoulder * 0.64 + hip * 0.36 + (joints[11, :2] - shoulder) * 0.44,
                width * 0.07,
            )
        )
        colours["Trousers"] = rgbhex(
            sample(joints[23, :2] * 0.45 + joints[25, :2] * 0.55, width * 0.085)
        )
        if joints[29, 2] > 0.65 and joints[31, 2] > 0.65:
            colours["Shoes"] = rgbhex(
                sample((joints[29, :2] + joints[31, :2]) / 2, width * 0.05)
            )
        record["bodyWeight"] = round(
            float(np.clip((sw / max(torso, 1) - 0.69) * 2.5, -0.75, 0.75)), 4
        )
        record["bodyFrame"] = round(
            float(np.clip((sw / max(hw, 1) - 1.41) * 2.8, -0.85, 0.85)), 4
        )
    if joints is not None:
        record["bodyAnchors"] = {
            str(i): [
                round(float(joints[i, 0] / w), 6),
                round(float(joints[i, 1] / h), 6),
            ]
            for i in (0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32)
            if joints[i, 2] > 0.45
        }
    return record


def face_texture(path, record):
    import cv2
    from face_warp import warp

    # Neutral landmarks in units of one face width, measured about the eye midpoint.
    src = {
        33: (-0.34, 0),
        263: (0.34, 0),
        133: (-0.111, -0.006),
        362: (0.111, -0.006),
        1: (0, -0.21),
        168: (0, 0.056),
        61: (-0.18, -0.435),
        291: (0.18, -0.435),
        0: (0, -0.40),
        17: (0, -0.477),
        10: (0, 0.52),
        152: (0, -0.785),
        234: (-0.50, -0.13),
        454: (0.50, -0.13),
    }
    keys = list(src)
    height, width = 384, 304
    j, i = np.mgrid[:height, :width]
    points = np.column_stack(
        (
            ((i + 0.5) / width * 1.1 - 0.55).ravel(),
            ((1 - (j + 0.5) / height) * 1.43 - 0.83).ravel(),
        )
    )
    mapped = warp(
        np.array([src[k] for k in keys]),
        np.array([record["faceAnchors"][str(k)] for k in keys]),
        points,
    )
    image = np.array(Image.open(path).convert("RGB"))
    pixels = (
        (mapped * np.array([image.shape[1], image.shape[0]]))
        .reshape(height, width, 2)
        .astype(np.float32)
    )
    face = cv2.remap(
        image, pixels, None, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )
    Image.fromarray(face).save(
        path.with_name("face-colour.jpg"), quality=93, subsampling=0
    )


def wardrobe_texture(path, record, segmenter):
    import cv2
    from face_warp import warp

    pairs = {
        0: (0, 1.59),
        11: (0.17, 1.32),
        12: (-0.17, 1.32),
        13: (0.331, 1.140),
        14: (-0.331, 1.140),
        15: (0.453, 1.016),
        16: (-0.453, 1.016),
        23: (0.101, 0.866),
        24: (-0.101, 0.866),
        25: (0.143, 0.474),
        26: (-0.143, 0.474),
        27: (0.181, 0.069),
        28: (-0.181, 0.069),
        31: (0.186, 0.009),
        32: (-0.186, 0.009),
    }
    landmarks = record.get("bodyAnchors", {})
    keys = [k for k in pairs if str(k) in landmarks]
    if len(keys) < 11:
        return
    img = np.array(Image.open(path).convert("RGB"))
    h, w = img.shape[:2]
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img)
    seg = segmenter.segment(image)
    mask = (np.squeeze(seg.category_mask.numpy_view()) == 4).astype(np.uint8) * 255
    H, W = 600, 448
    iy, ix = np.mgrid[0:H, 0:W]
    plane = np.column_stack(
        (((ix + 0.5) / W * 1.25 - 0.625).ravel(), ((1 - (iy + 0.5) / H) * 1.72).ravel())
    )
    warped = warp(
        np.array([pairs[k] for k in keys]),
        np.array([landmarks[str(k)] for k in keys]),
        plane,
    )
    pixels = (warped * np.array([w, h])).reshape(H, W, 2).astype(np.float32)
    cloth = cv2.remap(img, pixels, None, cv2.INTER_CUBIC)
    alpha = cv2.remap(mask, pixels, None, cv2.INTER_LINEAR)
    alpha = cv2.GaussianBlur(alpha, (7, 7), 1.7)
    Image.fromarray(cloth).save(path.with_name("wardrobe-colour.jpg"), quality=90)
    Image.fromarray(alpha).save(path.with_name("wardrobe-mask.png"), optimize=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("model_dir", type=Path)
    p.add_argument("ids", nargs="*")
    args = p.parse_args()
    vision = mp.tasks.vision
    base = mp.tasks.BaseOptions
    face = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(
            base_options=base(
                model_asset_path=str(args.model_dir / "face_landmarker.task")
            ),
            min_face_detection_confidence=0.35,
        )
    )
    pose = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=base(
                model_asset_path=str(args.model_dir / "pose_landmarker.task")
            )
        )
    )
    hair = vision.ImageSegmenter.create_from_options(
        vision.ImageSegmenterOptions(
            base_options=base(model_asset_path=str(args.model_dir / "hair.tflite")),
            output_category_mask=True,
            output_confidence_masks=False,
        )
    )
    from build_cast import build

    paths = (
        [ROOT / "Residents" / k / "reference.jpg" for k in args.ids]
        if args.ids
        else sorted((ROOT / "Residents").glob("*/reference.jpg"))
    )
    for path in paths:
        dest = path.with_name("photo-fit.json")
        if (
            path.with_name("face-sculpt.bin").exists()
            and path.with_name("wardrobe-colour.jpg").exists()
            and dest.exists()
            and json.loads(dest.read_text())["referenceSha256"]
            == hashlib.sha256(path.read_bytes()).hexdigest()
        ):
            continue
        try:
            result = fit(path, face, pose, hair)
        except ValueError as error:
            print(path.parent.name, error, flush=True)
            continue
        face_texture(path, result)
        wardrobe_texture(path, result, hair)
        dest.write_text(json.dumps(result, indent=2) + "\n")
        build(path.parent)
        print(path.parent.name, flush=True)
