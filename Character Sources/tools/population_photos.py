"""Cast and register a complete biography roster from original age-appropriate studio subjects."""

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import portrait_cast
from cast_measure import detectors, measure
from crowd_geometry import ROOT


def run(models, reserved, folders):
    cv2.setNumThreads(1)
    engines = detectors(models)
    portrait_cast.segmenter = engines[2]
    failures = {}
    completed = 0
    pool = []
    for i, folder in enumerate(folders):
        if folder.name == "AH-R0001":
            continue
        if i % 40 == 1 or not pool:
            for key in reserved:
                original = ROOT / "Residents" / key
                if (original / "reference.jpg").exists():
                    measure(original, engines)
            pool = portrait_cast.plates()
        if folder.name in reserved and not (folder / "reference.jpg").exists():
            continue
        receipt = folder / "casting.json"
        composite = not (folder / "reference.jpg").exists() or (
            receipt.exists()
            and json.loads(receipt.read_text()).get("method") == portrait_cast.METHOD
        )
        for attempt in range(5 if composite else 1):
            try:
                if composite:
                    portrait_cast.render(
                        folder,
                        pool,
                        attempt,
                        replace=attempt > 0
                        or (
                            folder.name in {"AH-R0047", "AH-R0050", "AH-R0551"}
                            and not (folder / "subject-mask.png").exists()
                        ),
                    )
                measure(folder, engines)
                if not np.isfinite(
                    np.fromfile(folder / "face-sculpt.bin", "<f4")
                ).all():
                    raise ValueError("invalid face measurement")
                completed += 1
                break
            except (ValueError, KeyError, IndexError) as error:
                if not composite or attempt == 4:
                    failures[folder.name] = str(error)
        if completed % 50 == 0:
            print(f"{completed} photographs registered in this pass", flush=True)
    if failures:
        print(json.dumps(failures), file=sys.stderr)
        raise SystemExit(1)
    print(f"{completed} photographs registered in this pass", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("models", type=Path)
    ap.add_argument(
        "--original-queue",
        type=Path,
        help="JSON array of subjects awaiting individual studio images",
    )
    ap.add_argument("ids", nargs="*")
    args = ap.parse_args()
    reserved = (
        [p["residentId"] for p in json.loads(args.original_queue.read_text())]
        if args.original_queue
        else []
    )
    root = ROOT / "Residents"
    folders = (
        [root / key for key in args.ids] if args.ids else sorted(root.glob("AH-R*"))
    )
    run(args.models, reserved, folders)
