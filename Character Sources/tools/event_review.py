"""Render the selected event take with its camera following horizontal root motion."""

import argparse
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from movement_review import setup

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("source", type=Path)
p.add_argument("frames", type=Path)
p.add_argument("--stride", type=int, default=2)
p.add_argument(
    "--focus-recovery",
    action="store_true",
    help="Bring the camera down to the palms during the get-up",
)
a = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
bpy.ops.wm.open_mainfile(filepath=str(a.source.resolve()), load_ui=False)
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == "ARMATURE")
setup(scene, a.source.parent)
camera = scene.camera
scene.render.resolution_x = 576
scene.render.resolution_y = 432
scene.cycles.samples = 5
scene.frame_set(1)
initial = rig.matrix_world.translation.copy()
lights = [(o, o.location.copy()) for o in scene.objects if o.type == "LIGHT"]
a.frames.mkdir(parents=True, exist_ok=True)
contact_frames = json.loads(rig.animation_data.action.get("palmContact", "[]"))
for i, frame in enumerate(range(1, scene.frame_end + 1, a.stride), 1):
    scene.frame_set(frame)
    root = rig.matrix_world.translation.copy()
    center = Vector((root.x, root.y - 0.07, 0.91))
    amount = 0.0
    if a.focus_recovery:
        for window in contact_frames:
            approach = min(1, max(0, (frame - window["firstFrame"] + 18) / 18))
            release = min(1, max(0, (window["lastFrame"] + 18 - frame) / 18))
            t = approach * release
            amount = max(amount, t * t * (3 - 2 * t))
    center.z -= 0.55 * amount
    camera.data.ortho_scale = 2.92 - 0.90 * amount
    # Keep the entire orthographic camera plane above the floor in the low shot.
    camera.location = center + 2.8 * Vector((-2.05, -3.85, 0.52 - 0.19 * amount))
    camera.rotation_euler = (
        (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    for o, rest in lights:
        o.location = rest + Vector((root.x - initial.x, root.y - initial.y, 0))
    scene.render.filepath = str(a.frames / f"{i:04d}.jpg")
    bpy.ops.render.render(write_still=True)
