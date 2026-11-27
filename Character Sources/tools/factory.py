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


def prepare_surfaces(folder, model_dir, art):
    """Invalidate only the measurements and textures whose inputs changed."""
    import hashlib

    folder = Path(folder)
    model_dir = Path(model_dir)
    resident = folder.name
    cache_file = folder / ".factory-fit.json"
    try:
        cache = json.loads(cache_file.read_text())
    except (FileNotFoundError, ValueError):
        cache = {}

    def stage(script, args, inputs, outputs):
        digest = hashlib.sha256()
        for path in [TOOLS / script, *inputs]:
            digest.update(path.name.encode())
            digest.update(hashlib.sha256(path.read_bytes()).digest())
        stamp = digest.hexdigest()
        if cache.get(script) == stamp and all(
            (folder / out).is_file() for out in outputs
        ):
            print(f"{resident} reuses {script}", flush=True)
            return
        subprocess.run(
            [sys.executable, str(TOOLS / script), *map(str, args)],
            env={**os.environ, "OPENBLAS_NUM_THREADS": "1"},
            check=True,
        )
        if not all((folder / out).is_file() for out in outputs):
            raise ValueError(f"Incomplete {script} output for {resident}")
        cache[script] = stamp
        with tempfile.NamedTemporaryFile(dir=folder, mode="w", delete=False) as temp:
            json.dump(cache, temp, indent=2)
        Path(temp.name).replace(cache_file)

    reference = folder / "reference.jpg"
    fit = folder / "photo-fit.json"
    face_model = model_dir / "face_landmarker.task"
    art_file = folder / "art-direction.json"
    stage(
        "fit_photo.py",
        [model_dir, resident, "--force", "--strict"],
        [
            reference,
            folder / "persona.json",
            TOOLS / "design.py",
            TOOLS / "build_cast.py",
            TOOLS / "appearance_recipes.py",
            *([art_file] if art_file.is_file() else []),
            # The close-up skin stage refines face-colour.jpg in place.
            *(
                [folder / "skin-reference.jpg"]
                if (folder / "skin-reference.jpg").is_file()
                else []
            ),
            *sorted((ROOT / "Anatomy").glob("*.glb")),
            face_model,
            model_dir / "pose_landmarker.task",
            model_dir / "hair.tflite",
            TOOLS / "face_warp.py",
        ],
        [
            "photo-fit.json",
            "character.gltf",
            "face-sculpt.bin",
            "face-colour.jpg",
            "wardrobe-colour.jpg",
            "wardrobe-mask.png",
        ],
    )
    if (folder / "skin-reference.jpg").is_file():
        stage(
            "skin_reference.py",
            [resident, model_dir],
            [folder / "skin-reference.jpg", face_model],
            ["skin-uv.bin"],
        )
    from appearance_recipes import use_wash_house_groom, surface_prefixes

    skin_reference = (folder / "skin-reference.jpg").is_file()
    if skin_reference:
        stage(
            "groom_reference.py",
            [resident, model_dir],
            [reference, fit, model_dir / "hair.tflite"],
            ["groom-guide.npz"],
        )
    scan = art.get("wardrobeScan")
    if scan and (Path(scan).name != scan or not scan.lower().endswith(".glb")):
        raise ValueError("wardrobeScan must name a local GLB")
    capture_groom = skin_reference and use_wash_house_groom(resident, art) and bool(scan)
    if capture_groom:
        stage(
            "capture_groom.py",
            [resident, model_dir, scan],
            [
                folder / scan,
                reference,
                fit,
                folder / "groom-guide.npz",
                face_model,
                model_dir / "hair.tflite",
            ],
            ["captured-hair.npz", "captured-hair.png", "frontal-locks.png", "captured-neck.jpg"],
        )
    prefixes = surface_prefixes(resident, art, skin_reference)
    if prefixes:
        inputs = [fit, TOOLS / "appearance_recipes.py"]
        if art_file.is_file():
            inputs.append(art_file)
        if "windbreaker" in prefixes:
            inputs += sorted((ROOT / "Anatomy" / "Textures").glob("cloth_*"))
            inputs += [folder / "wardrobe-colour.jpg", folder / "wardrobe-mask.png"]
        outputs = [
            name + "-" + suffix
            for name in prefixes
            for suffix in ("albedo.jpg", "normal.png", "roughness.png")
        ]
        if "windbreaker" in prefixes:
            outputs += ["windbreaker-photo.png", "jersey-photo.png"]
        if skin_reference:
            inputs += [
                reference,
                folder / "groom-guide.npz",
                folder / "skin-reference.jpg",
                folder / "skin-uv.bin",
                folder / "face-sculpt.bin",
                ROOT / "Anatomy" / "face-topology.obj",
                TOOLS / "fit_photo.py",
                TOOLS / "face_warp.py",
            ]
            if (folder / "skin-calibration.png").is_file():
                inputs.append(folder / "skin-calibration.png")
            outputs += ["skin-opacity.png"]
            if use_wash_house_groom(resident, art) and not capture_groom:
                inputs.append(TOOLS / "hair_shape.py")
                outputs += ["combed-hair.png", "hair-fibres.png"]
        stage("surface_maps.py", [resident], inputs, outputs)
    if art.get("rearPanel"):
        stage(
            "rear_reference.py",
            [resident, model_dir],
            [
                folder / "turnaround-reference.jpg",
                folder / "art-direction.json",
                fit,
                model_dir / "pose_landmarker.task",
                model_dir / "hair.tflite",
                TOOLS / "fit_photo.py",
            ],
            ["rear-colour.jpg", "rear-mask.png"],
        )


def build(resident, model_dir, blender, render_motion, game_only=False):
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
    prepare_surfaces(folder, model_dir, art)
    studio_flags = [] if game_only else ["--review"]
    run_blender(blender, "linked_masters.py", *studio_flags, resident)
    if art.get("performance"):
        run_blender(blender, "performance.py", resident)
    if game_only:
        return
    if art.get("performance"):
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
    if art.get("performance"):
        run_blender(blender, "face_review.py", resident, "--casting")
        subprocess.run(
            [
                sys.executable,
                str(TOOLS / "likeness_review.py"),
                resident,
                str(model_dir),
            ],
            check=True,
        )
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
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--render-motion", action="store_true")
    mode.add_argument(
        "--game-only",
        action="store_true",
        help="Build the fitted scene and its actions for gameplay packaging",
    )
    a = p.parse_args()
    build(a.resident, a.models, a.blender, a.render_motion, a.game_only)
