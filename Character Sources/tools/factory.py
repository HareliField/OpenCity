"""Build and review one named resident from their casting material."""

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"


def run_blender(binary, script, *args):
    subprocess.run(
        [
            str(binary),
            "-b",
            "--factory-startup",
            "--threads",
            "4",
            "--python-exit-code",
            "1",
            "-P",
            str(TOOLS / script),
            "--",
            *map(str, args),
        ],
        check=True,
    )


def build(resident, model_dir, blender, render_motion):
    if not re.fullmatch(r"AH-R[0-9]{4}", resident):
        raise ValueError("Expected one resident ID, such as AH-R0001")
    folder = ROOT / "Residents" / resident
    person = json.loads((folder / "persona.json").read_text())
    if person["residentId"] != resident:
        raise ValueError("Resident ID differs from persona")
    if not (folder / "reference.jpg").is_file():
        raise FileNotFoundError(
            "Add the resident’s full-length casting photograph before fitting"
        )
    if not (ROOT / "Anatomy" / "sculpts.blend").is_file():
        run_blender(blender, "linked_masters.py", "--library")
    direction = folder / "art-direction.json"
    art = json.loads(direction.read_text()) if direction.exists() else {}
    fit_env = {**os.environ, "OPENBLAS_NUM_THREADS": "1"}

    def fit_script(script, *args):
        subprocess.run(
            [sys.executable, str(TOOLS / script), *map(str, args)],
            env=fit_env,
            check=True,
        )

    fit_script("fit_photo.py", model_dir, resident)
    if not (folder / "face-sculpt.bin").is_file():
        raise ValueError("A visible face is required for the measured facial sculpt")
    if (folder / "skin-reference.jpg").is_file():
        fit_script("skin_reference.py", resident, model_dir)
    if art.get("hair") and (folder / "reference.jpg").is_file():
        fit_script("groom_reference.py", resident, model_dir)
    if art.get("rearPanel"):
        fit_script("rear_reference.py", resident, model_dir)
    run_blender(blender, "linked_masters.py", "--review", resident)
    if art.get("performance"):
        run_blender(blender, "performance.py", resident)
        if render_motion:
            import imageio_ffmpeg

            with tempfile.TemporaryDirectory(prefix="asphalt-movement-") as temp:
                frames = Path(temp)
                run_blender(blender, "movement_review.py", resident, frames)
                encode(frames, folder / "movement.mp4", imageio_ffmpeg.get_ffmpeg_exe())
        else:
            with tempfile.TemporaryDirectory(prefix="asphalt-contact-") as temp:
                run_blender(
                    blender, "movement_review.py", resident, temp, "--check-only"
                )
    run_blender(blender, "turntable.py", resident)
    run_blender(blender, "face_review.py", resident)
    run_blender(blender, "blender_master.py", resident)
    print(f"{person['name']} · {folder / 'character.blend'}")


def encode(frames, output, ffmpeg):
    with tempfile.TemporaryDirectory(dir=output.parent) as scratch:
        video = Path(scratch) / "review.mp4"
        subprocess.run(
            [
                str(ffmpeg),
                "-nostdin",
                "-loglevel",
                "error",
                "-y",
                "-framerate",
                "24",
                "-start_number",
                "1",
                "-i",
                str(frames / "%04d.jpg"),
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(video),
            ],
            check=True,
        )
        video.replace(output)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("resident")
    p.add_argument("--models", required=True, type=Path)
    p.add_argument(
        "--blender",
        type=Path,
        default=shutil.which("blender")
        or "/Applications/Blender.app/Contents/MacOS/Blender",
    )
    p.add_argument("--render-motion", action="store_true")
    a = p.parse_args()
    build(a.resident, a.models, a.blender, a.render_motion)
