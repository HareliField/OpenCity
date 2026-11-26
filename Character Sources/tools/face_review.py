"""Render a head-and-shoulders detail frame at the resident's listening beat."""

import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "Residents" / sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.open_mainfile(filepath=str(folder / "character.blend"), load_ui=False)
scene = bpy.context.scene
if scene.timeline_markers.get("Hear Rafael"):
    scene.frame_set(scene.timeline_markers["Hear Rafael"].frame + 14)
eyes = scene.objects["Eyes"].evaluated_get(bpy.context.evaluated_depsgraph_get())
bb = [eyes.matrix_world @ Vector(v) for v in eyes.bound_box]
center = sum(bb, Vector()) / len(bb)
target = center + Vector((0, 0.03, -0.033))
cam = scene.camera
cam.location = target + Vector((0.23, -2, 0.07))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.type = "ORTHO"
cam.data.ortho_scale = 0.36
scene.render.resolution_x = 560
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.cycles.samples = 22
scene.render.filepath = str(folder / "face-review.jpg")
bpy.ops.render.render(write_still=True)
