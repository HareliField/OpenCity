"""Open each native master headlessly, verify its articulation and photograph its standing mesh."""

import argparse
import json
import os
from pathlib import Path
import sys
import time

import bpy

ROOT = Path(__file__).resolve().parents[1]


def render(folder, output):
    scene_file = folder / "character.blend"
    dest = output / (folder.name + ".webp")
    p = json.loads((folder / "persona.json").read_text())
    bpy.ops.wm.open_mainfile(filepath=str(scene_file), load_ui=False)
    scene = bpy.context.scene
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    assert (
        len(
            [
                b
                for b in rig.data.bones
                if b.name.startswith(("thumb_", "index_", "middle_", "ring_", "pinky_"))
            ]
        )
        == 30
    ), folder.name
    if folder.name != "AH-R0001":
        text = json.loads(bpy.data.texts["Persona"].as_string())
        assert (
            text["residentId"] == folder.name
            and text["personId"] == p["personId"]
            and rig["personId"] == p["personId"]
        )
        assert (
            all(bpy.data.actions.get(k) for k in ("Walk", "Speak"))
            and len(rig.data.bones) >= 53
        )
        assert (
            scene["Casting photograph SHA256"]
            == json.loads((folder / "photo-fit.json").read_text())["referenceSha256"]
        )
        for im in bpy.data.images:
            if im.filepath and not im.packed_file:
                assert Path(bpy.path.abspath(im.filepath)).is_file(), (
                    folder.name,
                    im.filepath,
                )
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 4
    scene.cycles.use_denoising = True
    scene.render.resolution_percentage = 100
    scene.render.resolution_x = 284
    scene.render.resolution_y = 402
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 86
    tmp = dest.with_name(dest.stem + "-render.webp")
    scene.render.filepath = str(tmp)
    bpy.ops.render.render(write_still=True)
    os.replace(tmp, dest)
    print("STANDING", folder.name, dest.stat().st_size, flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("output", type=Path)
    ap.add_argument("--follow", action="store_true")
    ap.add_argument("ids", nargs="*")
    a = ap.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    out = a.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    waiting = a.ids or [f"AH-R{i:04}" for i in range(1, 1501)]
    while waiting:
        later = []
        for key in waiting:
            f = ROOT / "Residents" / key
            if key != "AH-R0001" and not (f / "manufacture.json").is_file():
                later.append(key)
                continue
            dest = out / (key + ".webp")
            if (
                dest.is_file()
                and dest.stat().st_mtime >= (f / "character.blend").stat().st_mtime
            ):
                continue
            render(f, out)
        if not a.follow:
            break
        waiting = later
        if later:
            time.sleep(2)
