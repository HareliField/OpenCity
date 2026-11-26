"""Build one gameplay GLB per approved resident, in manifest order."""

import argparse
import fcntl
import gzip
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from contextlib import contextmanager
from importlib import metadata, util
from pathlib import Path

from factory import ROOT, TOOLS

MODELS = ("face_landmarker.task", "pose_landmarker.task", "hair.tflite")


def read_manifest(path):
    ids = []
    seen = set()
    for number, raw in enumerate(path.read_text().splitlines(), 1):
        resident = raw.strip()
        if not resident or resident.startswith("#"):
            continue
        if not re.fullmatch(r"AH-R[0-9]{4}", resident) or resident in seen:
            raise ValueError(f"{path}:{number}: invalid or duplicate ID {resident!r}")
        ids.append(resident)
        seen.add(resident)
    if not ids:
        raise ValueError(f"{path}: no approved residents")
    return ids


def required(path):
    if not path.is_file() or not path.stat().st_size:
        raise ValueError(f"Missing or empty input: {path}")
    return path


def read_object(path):
    try:
        data = json.loads(required(path).read_text())
    except json.JSONDecodeError as error:
        raise ValueError(f"{path}: {error}") from error
    if not isinstance(data, dict):
        raise TypeError(f"Expected a JSON object in {path}")
    return data


def require_capture(key, catalog, frames=None):
    if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", key):
        raise ValueError(f"Invalid capture key {key!r}")
    required(ROOT / "Motion" / (key + ".npz"))
    if frames is not None and key in catalog and frames[1] > catalog[key]["frames"]:
        raise ValueError(
            f"{key}: frame range {frames} exceeds {catalog[key]['frames']} frames"
        )


def frame_range(frames, name):
    if (
        not isinstance(frames, list)
        or len(frames) != 2
        or not all(type(i) is int for i in frames)
        or not 0 <= frames[0] < frames[1]
    ):
        raise ValueError(f"{name}: invalid frame range {frames!r}")
    return frames


def resident_inputs(resident, catalog):
    folder = ROOT / "Residents" / resident
    person = read_object(folder / "persona.json")
    fields = ("name", "appearance", "personId", "agenda", "voice", "home", "occupation")
    if (
        person.get("residentId") != resident
        or any(not person.get(field) for field in fields)
        or not isinstance(person.get("age"), (int, float))
    ):
        raise ValueError(
            f"{resident}: persona ID mismatch or a required identity field is missing"
        )
    inputs = [folder / "persona.json", required(folder / "reference.jpg")]
    if (folder / "skin-reference.jpg").exists():
        inputs.append(required(folder / "skin-reference.jpg"))
    art_file = folder / "art-direction.json"
    if art_file.exists():
        art = read_object(art_file)
        inputs.append(art_file)
        if art.get("rearPanel"):
            inputs.append(required(folder / "turnaround-reference.jpg"))
        if art.get("performance"):
            perf = art["performance"]
            keys = ("take", "trigger", "cuts", "listenFrame", "markers")
            if (
                not isinstance(perf, dict)
                or not all(k in perf for k in keys)
                or "reactions" not in person
            ):
                raise ValueError(
                    f"{resident}: incomplete art-direction performance or persona reactions"
                )
            if not isinstance(perf["cuts"], list) or not perf["cuts"]:
                raise ValueError(f"{resident}: performance needs at least one cut")
            for cut in perf["cuts"]:
                if (
                    not isinstance(cut, list)
                    or len(cut) != 4
                    or type(cut[3]) is not int
                    or cut[3] < 1
                ):
                    raise ValueError(f"{resident}: invalid performance cut {cut!r}")
                require_capture(cut[0], catalog, frame_range(cut[1:3], resident))
    recipe_file = folder / "game-actions.json"
    if recipe_file.exists():
        recipe = read_object(recipe_file)
        if not recipe:
            raise ValueError(f"{resident}: game-actions.json contains no actions")
        inputs.append(recipe_file)
        for name, action in recipe.items():
            if isinstance(action, dict) and "baseAction" in action:
                sources = [
                    recipe.get(action.get(key, ""))
                    for key in ("baseAction", "holdAction")
                ]
                if any(
                    not isinstance(entry, dict) or "baseAction" in entry
                    for entry in sources
                ):
                    raise ValueError(
                        f"{resident} {name}: expected an existing gait and grip"
                    )
                if (
                    "take" in action
                    or "capture" in action
                    or type(action.get("holdFrame", -1)) is not int
                ):
                    raise ValueError(f"{resident} {name}: invalid held-load action")
                continue
            if not isinstance(action, dict) or ("take" in action) == (
                "capture" in action
            ):
                raise ValueError(f"{resident} {name}: expected one take or capture")
            frames = frame_range(action["frames"], name) if "frames" in action else None
            if "take" in action:
                take = action["take"]
                if (
                    not isinstance(take, str)
                    or Path(take).name != take
                    or not take.endswith(".blend")
                ):
                    raise ValueError(
                        f"{resident} {name}: expected a local Blender take filename"
                    )
                if take != "character.blend":
                    inputs.append(required(folder / take))
            else:
                require_capture(action["capture"], catalog, frames)
    else:
        for key in ("idle_shift", "walk_stop", "explain", "get_up"):
            require_capture(key, catalog)
    return sorted(set(inputs))


def file_hash(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def fingerprint(files, settings):
    data = [settings, [(name, file_hash(path)) for name, path in sorted(files.items())]]
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def verified(package, receipt, stamp):
    try:
        state = json.loads(receipt.read_text())
        return state["inputs"] == stamp and file_hash(package) == state["glb"]
    except (FileNotFoundError, ValueError, KeyError, TypeError):
        return False


def check_package_budget(package, target, max_mb):
    if max_mb is None:
        return
    other_bytes = sum(
        path.stat().st_size
        for path in package.parent.iterdir()
        if path != package
        and path.name.lower().endswith((".glb", ".glb.gz"))
        and path.is_file()
    )
    total = other_bytes + target.stat().st_size
    if total > max_mb * 1_000_000:
        raise ValueError(
            f"{package.name} would bring published GLBs to {total:,} bytes "
            f"and exceed the {max_mb:,} MB package budget"
        )


@contextmanager
def workspace(output):
    output.mkdir(parents=True, exist_ok=True)
    with (output / ".approved-cast.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        # An abrupt process exit can leave the last isolated Blender build behind.
        for old in output.glob(".approved-cast-*"):
            if (
                old.is_dir()
                and not old.is_symlink()
                and (old / ".owned-by-approved-cast").is_file()
            ):
                shutil.rmtree(old)
        with tempfile.TemporaryDirectory(prefix=".approved-cast-", dir=output) as tmp:
            work = Path(tmp)
            (work / ".owned-by-approved-cast").touch()
            yield work


def run(args):
    if args.max_package_mb is not None and args.max_package_mb < 0:
        raise ValueError("--max-package-mb must be nonnegative")
    ids = read_manifest(args.manifest)
    catalog = read_object(ROOT / "Motion/catalog.json")
    residents = {key: resident_inputs(key, catalog) for key in ids}
    versions = {}
    installed = metadata.packages_distributions()
    for name in ("cv2", "mediapipe", "numpy", "PIL"):
        if util.find_spec(name) is None:
            raise ValueError(f"Missing Python module {name} in {sys.executable}")
        versions.update(
            {dist: metadata.version(dist) for dist in installed.get(name, [])}
        )
    version = subprocess.check_output([args.blender, "--version"], text=True).strip()
    shared = {f"models/{name}": required(args.models / name) for name in MODELS}
    shared.update({f"tools/{path.name}": path for path in TOOLS.glob("*.py")})
    for area in ("Anatomy", "Motion"):
        shared.update(
            {
                str(p.relative_to(ROOT)): p
                for p in (ROOT / area).rglob("*")
                if p.is_file()
                and p.suffix
                in {".glb", ".blend", ".obj", ".json", ".npz", ".png", ".jpg"}
            }
        )
    for name in (
        "Anatomy/base_body.glb",
        "Anatomy/face-topology.obj",
        "Anatomy/joint-targets.json",
        "Motion/catalog.json",
    ):
        required(ROOT / name)
    settings = [version, sys.version, versions, args.texture_size, args.gzip]
    common = fingerprint(shared, settings)
    output = args.output.resolve()
    jobs = []
    for resident, inputs in residents.items():
        stamp = fingerprint({p.name: p for p in inputs}, common)
        package = output / (resident + (".glb.gz" if args.gzip else ".glb"))
        receipt = output / ".receipts" / (package.name + ".json")
        jobs.append((resident, inputs, stamp, package, receipt))
        if args.dry_run:
            status = (
                "verified, would reuse"
                if verified(package, receipt, stamp)
                else "would build"
            )
            print(f"{resident}: {status} {package}")
    if args.dry_run:
        return

    with workspace(output) as work:
        for resident, inputs, stamp, package, receipt in jobs:
            if verified(package, receipt, stamp):
                print(f"{resident}: verified {package}", flush=True)
                continue
            start = time.monotonic()
            if not (work / "tools").exists():
                # Blender resolves shared libraries relative to these scripts.
                # Use private copies so the factory can write intermediate files.
                for name, source in shared.items():
                    dest = work / name
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, dest)
                if (
                    fingerprint({name: work / name for name in shared}, settings)
                    != common
                ):
                    raise ValueError(
                        "Shared inputs changed during preparation. Rerun the manifest."
                    )
            folder = work / "Residents" / resident
            folder.mkdir(parents=True)
            for path in inputs:
                shutil.copy2(path, folder / path.name)
            if fingerprint({p.name: folder / p.name for p in inputs}, common) != stamp:
                raise ValueError(
                    f"{resident}: approved inputs changed during preparation. Rerun the manifest."
                )
            print(f"{resident}: building", flush=True)
            subprocess.run(
                [
                    sys.executable,
                    work / "tools/factory.py",
                    resident,
                    "--game-only",
                    "--models",
                    work / "models",
                    "--blender",
                    args.blender,
                ],
                check=True,
            )
            target = folder / (resident + ".glb")
            cmd = [
                args.blender,
                "-b",
                "--factory-startup",
                "--threads",
                "4",
                "--python-exit-code",
                "1",
                "-P",
                work / "tools/game_character.py",
                "--",
                resident,
                target,
                "--cache",
                folder / ".atlases",
            ]
            if args.texture_size:
                cmd += ["--texture-size", str(args.texture_size)]
            subprocess.run(cmd, check=True)
            if args.gzip:
                compressed = target.with_suffix(".glb.gz")
                with target.open("rb") as source, compressed.open("wb") as dest:
                    with gzip.GzipFile(
                        filename="", fileobj=dest, mode="wb", compresslevel=6, mtime=0
                    ) as stream:
                        shutil.copyfileobj(source, stream)
                target = compressed
            state = {
                "resident": resident,
                "inputs": stamp,
                "glb": file_hash(required(target)),
            }
            saved = folder / "receipt.json"
            saved.write_text(json.dumps(state, indent=2) + "\n")
            check_package_budget(package, target, args.max_package_mb)
            receipt.parent.mkdir(exist_ok=True)
            target.replace(package)
            saved.replace(receipt)
            shutil.rmtree(folder)
            print(
                f"{resident}: packaged {package} in {time.monotonic() - start:.2f}s",
                flush=True,
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "manifest", type=Path, help="Text file with one approved AH-R ID per line"
    )
    parser.add_argument("--models", required=True, type=Path)
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Directory for gameplay packages and receipts",
    )
    parser.add_argument(
        "--blender",
        default=shutil.which("blender")
        or "/Applications/Blender.app/Contents/MacOS/Blender",
    )
    parser.add_argument("--texture-size", type=int, choices=[256, 512, 768, 1024, 2048])
    parser.add_argument(
        "--gzip",
        action="store_true",
        help="Store losslessly compressed GLBs for the local game server",
    )
    parser.add_argument(
        "--max-package-mb",
        type=int,
        help="Limit the combined GLB files in the output directory (decimal MB). Excludes source and scratch.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Check inputs and existing packages without writing",
    )
    try:
        run(parser.parse_args())
    except (TypeError, ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"{parser.prog}: {error}\n")
