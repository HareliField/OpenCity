"""Materialize an editable resident in background Blender from their individual scene."""

import argparse
import hashlib
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0


def textures(folder):
    dest = ROOT / "Anatomy" / "Textures"
    dest.mkdir(exist_ok=True)
    for image in list(bpy.data.images):
        if not image.packed_file:
            continue
        data = image.packed_file.data
        ext = ".png" if data.startswith(b"\x89PNG") else ".jpg"
        path = dest / (image.name + "-" + hashlib.sha256(data).hexdigest()[:12] + ext)
        if not path.exists():
            path.write_bytes(data)
        external = bpy.data.images.load(str(path), check_existing=False)
        external.colorspace_settings.name = image.colorspace_settings.name
        image.user_remap(external)
        bpy.data.images.remove(image)


def bake_identity(obj):
    # The visible proportions become editable mesh coordinates. Preserve facial animation keys.
    key = obj.data.shape_keys
    if not key:
        return
    dynamic = [k for k in key.key_blocks if k.name.startswith("blink_")]
    import numpy as np

    n = len(obj.data.vertices)

    def coords(block):
        array = np.empty(n * 3, dtype=np.float32)
        block.data.foreach_get("co", array)
        return array

    basis = coords(key.key_blocks[0])
    faces = {k.name: coords(k) - basis for k in dynamic}
    identity = basis.copy()
    for k in list(key.key_blocks)[1:]:
        if k.value:
            identity += (coords(k) - basis) * k.value
    obj.shape_key_clear()
    obj.data.vertices.foreach_set("co", identity)
    obj.data.update()
    nonzero = {n: offset for n, offset in faces.items() if abs(offset).max() > 0.00001}
    if nonzero:
        obj.shape_key_add(name="Resident rest shape")
        for name, offset in nonzero.items():
            obj.shape_key_add(name=name).data.foreach_set("co", identity + offset)


def light(scene, name, pos, power, size, target):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (
        (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    )


def studio(rig, folder, filename="sculpt-review.jpg"):
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == "MESH" and o.find_armature() == rig]
    z = [(o.matrix_world @ Vector(b)).z for o in meshes for b in o.bound_box]
    h = max(z) - min(z)
    target = (0, 0, min(z) + h * 0.51)
    camera = bpy.data.cameras.new("Casting camera")
    obj = bpy.data.objects.new("Casting camera", camera)
    scene.collection.objects.link(obj)
    obj.location = (0, -3.7, h * 0.52)
    obj.rotation_euler = (
        (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    )
    scene.camera = obj
    camera.type = "ORTHO"
    camera.ortho_scale = h * 1.09
    light(scene, "Softbox", (-1.9, -2.8, 3.3), 200, 2.4, target)
    light(scene, "Fill", (1.9, -1.8, 2.0), 110, 2.0, target)
    light(scene, "Hair light", (1.1, 1.5, 2.8), 165, 1.8, target)
    scene.world = bpy.data.worlds.new("Neutral studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (
        0.38,
        0.39,
        0.40,
        1,
    )
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    if (folder / "art-direction.json").exists():
        # Reproduce the broad, neutral frontal source used in the casting photo.
        # Keep diffuse response on the skin while separating the visible backdrop
        # from the intensity of the lighting environment.
        scene.objects["Softbox"].data.energy = 105
        scene.objects["Softbox"].data.shape = "DISK"
        scene.objects["Softbox"].data.size = 3.4
        scene.objects["Fill"].data.energy = 60
        scene.objects["Fill"].data.size = 3.1
        scene.objects["Hair light"].data.energy = 24
        world = scene.world.node_tree
        world.nodes.get("Background").inputs[1].default_value = 0.42
        backdrop = world.nodes.new("ShaderNodeBackground")
        backdrop.inputs[0].default_value = (0.40, 0.395, 0.39, 1)
        mix = world.nodes.new("ShaderNodeMixShader")
        world.links.new(
            world.nodes.new("ShaderNodeLightPath").outputs["Is Camera Ray"],
            mix.inputs[0],
        )
        world.links.new(world.nodes.get("Background").outputs[0], mix.inputs[1])
        world.links.new(backdrop.outputs[0], mix.inputs[2])
        world.links.new(
            mix.outputs[0], world.nodes.get("World Output").inputs["Surface"]
        )
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 480
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    scene.render.filepath = str(folder / filename)
    bpy.ops.render.render(write_still=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("ids", nargs="+")
    p.add_argument("--review", action="store_true")
    args = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    for key in args.ids:
        folder = ROOT / "Residents" / key
        bpy.ops.wm.open_mainfile(filepath=str(folder / "character.blend"))
        bpy.context.preferences.filepaths.save_version = 0
        rig = next(
            o
            for o in bpy.context.scene.objects
            if o.type == "ARMATURE" and o.get("residentId") == key
        )
        paths = {
            Path(image.filepath).name: bpy.path.abspath(
                image.filepath, library=image.library
            )
            for image in bpy.data.images
            if image.filepath
        }
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.make_local(type="ALL")
        for image in bpy.data.images:
            if image.filepath and Path(image.filepath).name in paths:
                image.filepath = paths[Path(image.filepath).name]
        for obj in list(bpy.context.scene.objects):
            if obj.type != "MESH" or obj.find_armature() != rig:
                continue
            if obj.data.users > 1:
                obj.data = obj.data.copy()
            if obj.data.shape_keys and obj.data.shape_keys.key_blocks.get(
                "gender_male"
            ):
                bake_identity(obj)
        if args.review:
            studio(rig, folder)
        bpy.ops.file.make_paths_absolute()
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(
            filepath=str(folder / "sculpt-master.blend"), compress=True
        )


if __name__ == "__main__":
    main()
