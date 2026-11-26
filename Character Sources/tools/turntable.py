"""Render front, three-quarter and back of one fitted sculpt for visual comparison."""

import argparse, math, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]


def review(folder):
    bpy.ops.wm.open_mainfile(filepath=str(folder / "character.blend"), load_ui=False)
    scene = bpy.context.scene
    camera = scene.camera
    if not camera:
        return False
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    meshes = [o for o in scene.objects if o.type == "MESH" and o.find_armature() == rig]
    z = [(o.matrix_world @ Vector(v)).z for o in meshes for v in o.bound_box]
    origin = rig.matrix_world.translation.copy()
    target = Vector((origin.x, origin.y, min(z) + (max(z) - min(z)) * 0.51))
    camera.location = target + Vector((0, -3.7, 0.02))
    camera.rotation_euler = (
        (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    lights = [o for o in scene.objects if o.type == "LIGHT"]
    original = {o: o.matrix_world.copy() for o in lights + [camera]}
    scene.render.resolution_x = 320
    scene.render.resolution_y = 480
    scene.render.resolution_percentage = 100
    scene.cycles.samples = 6
    frames = []
    for angle in [0, 39, 180]:
        rot = (
            Matrix.Translation(target)
            @ Matrix.Rotation(math.radians(angle), 4, "Z")
            @ Matrix.Translation(-target)
        )
        for o in lights + [camera]:
            o.matrix_world = rot @ original[o]
        path = folder / f".turn-{angle}.jpg"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        frame = bpy.data.images.load(str(path))
        w, h = frame.size
        buf = np.empty(w * h * 4, dtype=np.float32)
        frame.pixels.foreach_get(buf)
        frames.append(buf.reshape(h, w, 4))
        bpy.data.images.remove(frame)
        path.unlink()
    strip = np.concatenate(frames, axis=1)
    out = bpy.data.images.new(
        "Front, three-quarter and back", width=strip.shape[1], height=strip.shape[0]
    )
    out.pixels.foreach_set(strip.ravel())
    out.file_format = "JPEG"
    out.filepath_raw = str(folder / "turntable.jpg")
    out.save()
    return True


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("ids", nargs="+")
    a = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    for key in a.ids:
        review(ROOT / "Residents" / key)
