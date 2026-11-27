"""Build an editable and poseable native master from the same fitted surface that ships to the game."""

import argparse
from pathlib import Path
import json
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from resident_motion import captured, portion, write_action


def studio(scene, height):
    def aim(o, at):
        o.rotation_euler = (Vector(at) - o.location).to_track_quat("-Z", "Y").to_euler()

    bpy.ops.object.camera_add(location=(0, -4.1, height * 0.53))
    cam = bpy.context.object
    cam.name = "Standing portrait"
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = height * 1.10
    aim(cam, (0, 0, height * 0.51))
    scene.camera = cam
    bpy.ops.object.light_add(type="AREA", location=(-2.0, -2.7, 3.3))
    light = bpy.context.object
    light.name = "Studio window"
    light.data.energy = 100
    light.data.shape = "DISK"
    light.data.size = 4
    aim(light, (0, 0, height * 0.58))
    bpy.ops.object.light_add(type="AREA", location=(1.8, 1.6, 2.8))
    light = bpy.context.object
    light.name = "Soft edge light"
    light.data.energy = 55
    light.data.size = 2
    aim(light, (0, 0, height * 0.62))
    world = bpy.data.worlds.new("Neutral studio")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.68, 0.67, 0.65, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.82
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 540
    scene.render.resolution_y = 740
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 92
    scene.view_settings.view_transform = "Standard"
    return cam


def build(folder, out, preview=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    p = json.loads((folder / "persona.json").read_text())
    src = out / "cast" / (folder.name + ".gltf")
    doc = json.loads(src.read_text())
    bpy.ops.import_scene.gltf(
        filepath=str(src), bone_heuristic="BLENDER", import_pack_images=False
    )
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    rig.name = p["name"] + " | " + p["residentId"]
    rig["personId"] = p["personId"]
    rig["voice"] = p["voice"]
    rig["agenda"] = p["agenda"]
    rig["familyIds"] = p["familyIds"]
    rig["under pressure"] = p["reactions"][0]["response"]
    text = bpy.data.texts.new("Persona")
    text.write(json.dumps(p, indent=2, ensure_ascii=False))
    scene["Casting photograph SHA256"] = doc["asset"]["extras"]["reference"]
    scene["Character factory"] = doc["asset"]["extras"]["factory"]
    scene.render.fps = 30
    # Actions use this resident's measured limb axes. The full capture catalogue is available
    # through resident_motion; the two frequently reviewed actions remain directly editable here.
    for key, title, frames in [("slow_stride", "Walk", 44), ("explain", "Speak", 32)]:
        take = captured(rig, key)
        seq = portion(take, 0, min(len(take["location"]), frames), count=16)
        action = write_action(rig, title, seq)
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        co = np.empty((len(curve.keyframe_points), 2), "f")
                        curve.keyframe_points.foreach_get("co", co.ravel())
                        co[:, 0] = 1 + (co[:, 0] - 1) * (frames - 1) / max(
                            1, len(co) - 1
                        )
                        curve.keyframe_points.foreach_set("co", co.ravel())
                        curve.update()
    rig.animation_data_clear()
    for b in rig.pose.bones:
        b.matrix_basis.identity()
    height = max(
        doc["accessors"][prim["attributes"]["POSITION"]]["max"][1]
        for mesh in doc["meshes"]
        for prim in mesh["primitives"]
    )
    cam = studio(scene, height)
    dest = folder / "character.blend"
    for im in bpy.data.images:
        if im.filepath:
            absolute = bpy.path.abspath(im.filepath)
            im.filepath = "//" + os.path.relpath(absolute, folder)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(dest), compress=True, relative_remap=False)
    if preview:
        # Reopen to exercise relative texture resolution exactly as an artist will see it.
        bpy.ops.wm.open_mainfile(filepath=str(dest))
        scene = bpy.context.scene
        cam = scene.camera
        scene.render.filepath = str(preview / (folder.name + "-front.jpg"))
        bpy.ops.render.render(write_still=True)
        cam.location = (2.45, -3.30, height * 0.55)
        cam.rotation_euler = (
            (Vector((0, 0, height * 0.51)) - cam.location)
            .to_track_quat("-Z", "Y")
            .to_euler()
        )
        scene.render.filepath = str(preview / (folder.name + "-turn.jpg"))
        bpy.ops.render.render(write_still=True)
    print("CAST MASTER", p["residentId"], dest.stat().st_size, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("game_assets", type=Path)
    parser.add_argument("ids", nargs="*")
    parser.add_argument("--preview", type=Path)
    parser.add_argument("--ids-file", type=Path)
    a = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    out = a.game_assets.resolve()
    if a.preview:
        a.preview.mkdir(parents=True, exist_ok=True)
    ids = a.ids or (
        a.ids_file.read_text().splitlines()
        if a.ids_file
        else sorted(p.stem for p in (out / "cast").glob("AH-R*.gltf"))
    )
    for key in ids:
        if key != "AH-R0001":
            build(ROOT / "Residents" / key, out, a.preview)
