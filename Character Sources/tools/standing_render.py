"""Photograph the exported gameplay rig in Idle using the original casting-camera registration."""

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_master import light


def photograph(package, registration, output, frame):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(package.resolve()))
    scene = bpy.context.scene
    # glTF has no per-object shadow flag. Match the live renderer and the native
    # master, where overlapping translucent strands do not cast opaque shadows.
    for obj in scene.objects:
        if obj.name.startswith(("Captured bun", "Loose temple", "Combed scalp")):
            obj.visible_shadow = False
    rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
    idle = bpy.data.actions["Idle"]
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rig.animation_data.action = idle
    rig.animation_data.action_slot = next(
        slot for slot in idle.slots if slot.target_id_type == "OBJECT"
    )
    scene.frame_set(frame)
    camera = bpy.data.cameras.new("Casting camera")
    cam = bpy.data.objects.new(camera.name, camera)
    scene.collection.objects.link(cam)
    scene.camera = cam
    camera.type = "ORTHO"
    camera.ortho_scale = registration["heightMeters"]
    cx = (0.5 - registration["centerX"]) * registration["widthMeters"]
    cz = (registration["soleY"] - 0.5) * registration["heightMeters"]
    cam.location = (cx, -3.7, cz)
    cam.rotation_euler = Vector((0, 1, 0)).to_track_quat("-Z", "Y").to_euler()
    target = (0, 0, 1.0)
    light(scene, "Broad studio window", (-1.9, -2.8, 3.3), 105, 3.4, target)
    light(scene, "Frontal bounce", (1.9, -1.8, 2.0), 60, 3.1, target)
    light(scene, "Backdrop bounce", (1.1, 1.5, 2.8), 24, 1.8, target)
    world = bpy.data.worlds.new("Diffuse studio")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.38, 0.39, 0.40, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.42
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(output.resolve())
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("package", type=Path)
    p.add_argument("fit", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--frame", type=int, default=13)
    args = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    photograph(
        args.package,
        json.loads(args.fit.read_text())["registration"],
        args.output,
        args.frame,
    )
