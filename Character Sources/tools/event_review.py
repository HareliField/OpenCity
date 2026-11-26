"""Render the selected event take with its camera following horizontal root motion."""

import argparse
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
for i, frame in enumerate(range(1, scene.frame_end + 1, a.stride), 1):
    scene.frame_set(frame)
    root = rig.matrix_world.translation.copy()
    center = Vector((root.x, root.y - 0.07, 0.91))
    camera.location = center + Vector((-2.05, -3.85, 0.52))
    camera.rotation_euler = (
        (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    for o, rest in lights:
        o.location = rest + Vector((root.x - initial.x, root.y - initial.y, 0))
    scene.render.filepath = str(a.frames / f"{i:04d}.jpg")
    bpy.ops.render.render(write_still=True)
