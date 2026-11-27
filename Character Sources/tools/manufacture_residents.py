"""Checkpoint pictures, game packages and directly editable Blender scenes one resident at a time."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import time

import cv2
from crowd_geometry import ROOT
from population_models import FACTORY, atomic, publish_model, roster
from compact_masters import compress_frames
from resident_portraits import thumbnail


def run(args):
    cv2.setNumThreads(1)
    output = args.assets.resolve()
    (output / "cast").mkdir(parents=True, exist_ok=True)
    (output / "library").mkdir(exist_ok=True)
    folders = [
        p.parent
        for p in sorted((ROOT / "Residents").glob("AH-R*/persona.json"))
        if p.parent.name != "AH-R0001"
    ]
    pending = {f.name: f for f in folders}
    tot = len(pending)
    done = 0
    while pending:
        ready = [f for f in pending.values() if (f / "subject-mask.png").exists()][
            : args.chunk
        ]
        if not ready:
            if not args.follow:
                raise ValueError(f"{len(pending)} references still need registration")
            time.sleep(3)
            continue
        masters = []
        for folder in ready:
            publish_model(folder, output, args.hand_model)
            rec = folder / "manufacture.json"
            ref = json.loads((folder / "photo-fit.json").read_text())["referenceSha256"]
            old = json.loads(rec.read_bytes()) if rec.exists() else {}
            native = folder / "character.blend"
            if (
                old.get("version") != FACTORY
                or old.get("reference") != ref
                or not native.is_file()
                or native.stat().st_size != old.get("blendBytes")
            ):
                masters.append(folder)
        if masters:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt") as ids:
                ids.write("".join(f.name + "\n" for f in masters))
                ids.flush()
                subprocess.run(
                    [
                        str(args.blender),
                        "-b",
                        "--threads",
                        "2",
                        "--python-exit-code",
                        "1",
                        "--python",
                        str(ROOT / "tools/population_blender.py"),
                        "--",
                        str(output),
                        "--ids-file",
                        ids.name,
                    ],
                    check=True,
                    stdout=subprocess.DEVNULL,
                )
            for f in masters:
                ref = json.loads((f / "photo-fit.json").read_text())["referenceSha256"]
                native = f / "character.blend"
                mesh = output / "cast" / (f.name + ".bin")
                atomic(native, compress_frames(native.read_bytes()))
                atomic(
                    f / "manufacture.json",
                    json.dumps(
                        {
                            "residentId": f.name,
                            "version": FACTORY,
                            "reference": ref,
                            "masterCompression": 11,
                            "blendBytes": native.stat().st_size,
                            "blendSha256": hashlib.sha256(
                                native.read_bytes()
                            ).hexdigest(),
                            "geometrySha256": hashlib.sha256(
                                mesh.read_bytes()
                            ).hexdigest(),
                            "gameModel": "cast/" + f.name + ".gltf",
                        }
                    ).encode(),
                )
        for f in ready:
            thumbnail(f, output / "portraits")
            del pending[f.name]
            done += 1
        print(f"{done}/{tot} finished Blender, game and persona packages", flush=True)
    thumbnail(ROOT / "Residents" / "AH-R0001", output / "portraits")
    roster(output)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("assets", type=Path)
    p.add_argument("blender", type=Path)
    p.add_argument("--hand-model", type=Path, required=True)
    p.add_argument("--chunk", type=int, default=40)
    p.add_argument("--follow", action="store_true")
    run(p.parse_args())
