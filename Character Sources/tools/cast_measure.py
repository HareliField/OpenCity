"""Measure the casting photo, keeping an aligned full-length garment and hair matte."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile

import cv2
import mediapipe as mp
import numpy as np
from PIL import Image
from fit_photo import fit, ROOT


def detectors(model_dir):
    v = mp.tasks.vision

    def base(file):
        return mp.tasks.BaseOptions(model_asset_path=str(model_dir / file))

    return (
        v.FaceLandmarker.create_from_options(
            v.FaceLandmarkerOptions(
                base_options=base("face_landmarker.task"),
                min_face_detection_confidence=0.30,
            )
        ),
        v.PoseLandmarker.create_from_options(
            v.PoseLandmarkerOptions(
                base_options=base("pose_landmarker.task"),
                min_pose_detection_confidence=0.35,
            )
        ),
        v.ImageSegmenter.create_from_options(
            v.ImageSegmenterOptions(
                base_options=base("hair.tflite"),
                output_category_mask=True,
                output_confidence_masks=False,
            )
        ),
    )


def full_matte(picture, marks, segmenter):
    image = np.asarray(picture)
    h, w = image.shape[:2]

    def parse(im):
        frame = mp.Image(
            image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(im)
        )
        return segmenter.segment(frame).category_mask.numpy_view().squeeze().copy()

    classes = parse(image)
    pts = marks[:, :2] * [w, h]
    eye = pts[[33, 263]].mean(0)
    fw = np.linalg.norm(pts[234] - pts[454])
    x0, x1 = np.clip([int(eye[0] - 1.10 * fw), int(eye[0] + 1.10 * fw)], 0, w)
    y0, y1 = np.clip([int(eye[1] - 1.18 * fw), int(eye[1] + 1.02 * fw)], 0, h)
    if x1 > x0 and y1 > y0:
        head = parse(image[y0:y1, x0:x1])
        patch = classes[y0:y1, x0:x1]
        change = np.isin(head, [1, 3, 5]) | (np.isin(patch, [1, 3, 5]) & (head == 0))
        patch[change] = head[change]
    # Restore fine silhouette features at the edge of a low-resolution network mask.
    region = np.uint8(classes > 0)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    core = cv2.erode(region, k)
    outside = cv2.dilate(region, k)
    gc = np.where(outside, cv2.GC_PR_BGD, cv2.GC_BGD).astype("uint8")
    gc[region > 0] = cv2.GC_PR_FGD
    gc[core > 0] = cv2.GC_FGD
    if core.any() and np.any(gc == cv2.GC_BGD):
        cv2.grabCut(
            image,
            gc,
            None,
            np.zeros((1, 65)),
            np.zeros((1, 65)),
            1,
            cv2.GC_INIT_WITH_MASK,
        )
        solid = np.uint8((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD))
        _, labels, stats, _ = cv2.connectedComponentsWithStats(solid)
        if len(stats) > 1:
            biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            solid = (labels == biggest).astype("uint8")
        # Material boundaries grow from photographed neighbours, never from the backdrop.
        _, nearest = cv2.distanceTransformWithLabels(
            1 - region, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
        )
        palette = np.zeros(nearest.max() + 1, "uint8")
        palette[nearest[region > 0]] = classes[region > 0]
        classes = np.where(solid, palette[nearest], 0).astype("uint8")
    return classes


def measure(folder, engines):
    photo = folder / "reference.jpg"
    sha = hashlib.sha256(photo.read_bytes()).hexdigest()
    fit_path = folder / "photo-fit.json"
    record = json.loads(fit_path.read_text()) if fit_path.exists() else {}
    marks_path = folder / "face-sculpt.bin"
    matte_path = folder / "subject-mask.png"
    if (
        record.get("referenceSha256") == sha
        and marks_path.is_file()
        and matte_path.is_file()
        and record.get("subjectMatteVersion") == 1
    ):
        return record
    if record.get("referenceSha256") != sha or not marks_path.is_file():
        record = fit(photo, *engines)
    marks = np.fromfile(marks_path, "<f4").reshape(468, 3)
    img = Image.open(photo).convert("RGB")
    img.thumbnail((640, 960), Image.Resampling.LANCZOS)
    classes = full_matte(img, marks, engines[2])
    yy, xx = np.where(classes > 0)
    if len(yy) < img.width * img.height * 0.025 or not record.get("bodyAnchors"):
        raise ValueError(folder.name + " does not have a measurable standing subject")
    record["subjectMatteVersion"] = 1
    record["subjectBounds"] = [
        round(float(v), 6)
        for v in (
            xx.min() / img.width,
            yy.min() / img.height,
            (xx.max() + 1) / img.width,
            (yy.max() + 1) / img.height,
        )
    ]
    with tempfile.NamedTemporaryFile(dir=folder, suffix=".png", delete=False) as tmp:
        matte = Path(tmp.name)
    Image.fromarray(classes).save(matte, format="PNG", optimize=True)
    os.replace(matte, matte_path)
    temp = fit_path.with_suffix(".json.pending")
    temp.write_text(json.dumps(record, indent=2) + "\n")
    temp.replace(fit_path)
    return record


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("models", type=Path)
    cli.add_argument("ids", nargs="*")
    a = cli.parse_args()
    cv2.setNumThreads(1)
    engines = detectors(a.models)
    files = (
        [ROOT / "Residents" / key for key in a.ids]
        if a.ids
        else [p.parent for p in sorted((ROOT / "Residents").glob("*/reference.jpg"))]
    )
    for f in files:
        if f.name == "AH-R0001":
            continue
        measure(f, engines)
        print(f.name, flush=True)
