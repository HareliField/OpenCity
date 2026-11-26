"""Write light, individually poseable Blender masters over the shared sculpt library."""

import argparse
import json
import os
from pathlib import Path
import sys
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from build_cast import Scene, library, linear_colour
from design import design
from blender_master import clear, studio, textures
from portrait_surface import coordinates
from character_motion import listening, reference_stance
from groom import groom
from face_sculpt import sculpt
from hero_finishes import apply as apply_finishes

LIB = ROOT / "Anatomy" / "sculpts.blend"


def control(owner, prop, key, index=None, default=0):
    curve = owner.driver_add(prop) if index is None else owner.driver_add(prop, index)
    driver = curve.driver
    driver.type = "AVERAGE"
    var = driver.variables.new()
    var.type = "CONTEXT_PROP"
    target = var.targets[0]
    target.context_property = "ACTIVE_SCENE"
    target.data_path = (
        '["' + key + '"]' + ("[" + str(index) + "]" if index is not None else "")
    )
    target.use_fallback_value = True
    target.fallback_value = default


def canonical_face(obj, eyes):
    eye = coordinates(eyes)
    pts = coordinates(obj)
    x, y, z = pts.T
    ex = (eye[:, 0].max() - eye[:, 0].min()) * 0.5
    ez = (eye[:, 2].max() + eye[:, 2].min()) * 0.5
    ey = np.median(eye[:, 1])
    fw = ex * 3.04
    from portrait_surface import smoothstep

    u = x / fw + 0.55
    v = ((z - ez) / fw + 0.83) / 1.43
    uv = np.column_stack((u / 1.1, v)).astype(np.float32)
    alpha = (
        smoothstep(0.53, 0.39, abs(x) / fw)
        * smoothstep(-0.77, -0.65, (z - ez) / fw)
        * smoothstep(0.50, 0.36, (z - ez) / fw)
        * smoothstep(ey + 0.062, ey + 0.014, y)
    )
    loops = np.empty(len(obj.data.loops), dtype=np.int32)
    obj.data.loops.foreach_get("vertex_index", loops)
    layer = obj.data.uv_layers.new(name="Face detail")
    layer.data.foreach_set("uv", uv[loops].ravel())
    mask = obj.data.color_attributes.new(
        name="Face detail coverage", type="FLOAT_COLOR", domain="POINT"
    )
    mask.data.foreach_set(
        "color",
        np.column_stack((alpha, alpha, alpha, np.ones(len(x))))
        .astype(np.float32)
        .ravel(),
    )


def garment_projection(obj):
    from portrait_surface import smoothstep

    pts = coordinates(obj)
    mesh = obj.data
    normals = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("normal", normals)
    alpha = smoothstep(-0.05, 0.72, -normals.reshape(-1, 3)[:, 1])
    uv = np.column_stack((pts[:, 0] / 1.25 + 0.5, pts[:, 2] / 1.72)).astype(np.float32)
    loops = np.empty(len(mesh.loops), dtype=np.int32)
    mesh.loops.foreach_get("vertex_index", loops)
    layer = mesh.uv_layers.new(name="Front garment")
    layer.data.foreach_set("uv", uv[loops].ravel())
    attr = mesh.color_attributes.new(
        name="Front garment coverage", type="FLOAT_COLOR", domain="POINT"
    )
    attr.data.foreach_set(
        "color",
        np.column_stack((alpha, alpha, alpha, np.ones(len(alpha))))
        .astype(np.float32)
        .ravel(),
    )


def library_build():
    clear()
    person = {"name": "Resident rig"}
    layers = sorted(p.stem for p in LIB.parent.glob("*.glb") if p.stem != "base_body")
    colours = {
        k: "#ffffff" for k in ("Hair", "Skin", "Trousers", "Shoes", "Undershirt", "Top")
    }
    weight = {
        k: 0 for k in library("base_body")[0]["meshes"][0]["extras"]["targetNames"]
    }
    assembly = Scene(person, layers, colours, weight)
    for k in ["base_body"] + layers:
        assembly.add(k)
    # Blender resolves relative buffer URIs from the temporary manifest.
    for b in assembly.g["buffers"]:
        b["uri"] = Path(b["uri"]).name
    path = LIB.with_suffix(".gltf")
    path.write_text(json.dumps(assembly.g))
    try:
        bpy.ops.import_scene.gltf(
            filepath=str(path), bone_heuristic="BLENDER", import_pack_images=True
        )
    finally:
        path.unlink()
    canonical_face(bpy.data.objects["Body"], bpy.data.objects["Eyes"])
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.data.shape_keys:
            continue
        if obj.name.startswith("Cloth_"):
            garment_projection(obj)
        for k in list(obj.data.shape_keys.key_blocks)[1:]:
            control(k, "value", "shape_" + k.name)
    for material in bpy.data.materials:
        n = material.name
        if n == "Skin":
            region = "Skin"
        elif n.startswith("Hair") or n == "Eyebrow":
            region = "Hair"
        elif n.startswith("Cloth_"):
            region = n
        else:
            continue
        nt = material.node_tree
        bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        base = bs.inputs["Base Color"]
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 1
        if base.links:
            nt.links.new(base.links[0].from_socket, mix.inputs[1])
        else:
            mix.inputs[1].default_value = base.default_value
        for i in range(3):
            control(mix.inputs[2], "default_value", "tint_" + region, i, 1)
        nt.links.new(mix.outputs[0], base)
        if region == "Skin":
            bs.inputs["Subsurface Weight"].default_value = 0.085
            bs.inputs["Subsurface Scale"].default_value = 0.0014
    from resident_motion import attach_library

    attach_library()
    textures(ROOT)
    for img in bpy.data.images:
        if img.filepath and Path(img.filepath).is_file():
            img.filepath = "//Textures/" + Path(img.filepath).name
    bpy.ops.wm.save_as_mainfile(filepath=str(LIB), compress=True, relative_remap=False)


def portrait_material(folder, body, garment=False):
    photo = folder / ("wardrobe-colour.jpg" if garment else "face-colour.jpg")
    if not photo.exists():
        return
    slot = (
        body.material_slots[0]
        if garment
        else next(slot for slot in body.material_slots if slot.material.name == "Skin")
    )
    mat = slot.material.copy()
    slot.link = "OBJECT"
    slot.material = mat
    mat.name = folder.name + " " + body.name
    nt = mat.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    old = bs.inputs["Base Color"].links[0].from_socket
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "Front garment" if garment else "Face detail"
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(photo), check_existing=True)
    img.extension = "CLIP"
    nt.links.new(uv.outputs["UV"], img.inputs["Vector"])
    mask = nt.nodes.new("ShaderNodeVertexColor")
    mask.layer_name = "Front garment coverage" if garment else "Face detail coverage"
    mix = nt.nodes.new("ShaderNodeMixRGB")
    factor = mask.outputs["Color"]
    if garment:
        alpha = nt.nodes.new("ShaderNodeTexImage")
        alpha.image = bpy.data.images.load(
            str(folder / "wardrobe-mask.png"), check_existing=True
        )
        alpha.image.colorspace_settings.name = "Non-Color"
        nt.links.new(uv.outputs["UV"], alpha.inputs["Vector"])
        combine = nt.nodes.new("ShaderNodeMath")
        combine.operation = "MULTIPLY"
        nt.links.new(factor, combine.inputs[0])
        nt.links.new(alpha.outputs["Color"], combine.inputs[1])
        factor = combine.outputs[0]
    nt.links.new(factor, mix.inputs[0])
    nt.links.new(old, mix.inputs[1])
    nt.links.new(img.outputs["Color"], mix.inputs[2])
    nt.links.new(mix.outputs[0], bs.inputs["Base Color"])


def fit_joints(rig, weights):
    from mathutils import Vector

    rig.data = rig.data.copy()
    data = JOINT_TARGETS["morphs"]
    offsets = {}
    for key, value in weights.items():
        for bone, delta in data.get(key, {}).items():
            xyz = Vector((delta[0], -delta[2], delta[1])) * value
            offsets[bone] = offsets.get(bone, Vector()) + xyz
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = rig.data.edit_bones
    coords = {b.name: (b.head.copy(), b.tail.copy()) for b in bones}
    for b in bones:
        a, z = coords[b.name]
        delta = offsets.get(b.name, Vector())
        other = next(
            (c.name for c in b.children if (coords[c.name][0] - z).length < 0.002), None
        )
        b.head = a + delta
        b.tail = z + offsets.get(other, delta)
    bpy.ops.object.mode_set(mode="OBJECT")


JOINT_TARGETS = json.loads((ROOT / "Anatomy" / "joint-targets.json").read_text())


def create(folder, review):
    clear()
    person = json.loads((folder / "persona.json").read_text())
    fit = folder / "photo-fit.json"
    parts, colours, weights = design(
        person, json.loads(fit.read_text()) if fit.exists() else None
    )
    from appearance_recipes import fitted_layers

    parts = fitted_layers(folder, parts)
    names = [
        "Resident rig",
        "Body",
        "Teeth",
        "Tongue",
        "Eyes",
        "Eyebrows",
        "Eyelashes",
    ] + [p.replace("clothing_", "Cloth_").replace("hair_", "Hair_") for p in parts]
    with bpy.data.libraries.load(str(LIB), link=True) as (src, dest):
        dest.objects = list(names)
    objects = {obj.name: obj for obj in dest.objects}
    scene = bpy.context.scene
    rig = objects["Resident rig"].copy()
    rig.name = person["name"]
    scene.collection.objects.link(rig)
    fit_joints(rig, weights)
    for name in names[1:]:
        obj = objects[name].copy()
        obj.name = name
        scene.collection.objects.link(obj)
        obj.parent = rig
        for mod in obj.modifiers:
            if mod.type == "ARMATURE":
                mod.object = rig
        if name == "Body":
            portrait_material(folder, obj)
        elif name.startswith("Cloth_") and name not in ("Cloth_shoes", "Cloth_boots"):
            portrait_material(folder, obj, True)
    for k, v in list(weights.items()):
        scene["shape_" + k] = v
    for name in library("base_body")[0]["meshes"][0]["extras"]["targetNames"]:
        if name.startswith("corr_"):
            a, b = name[5:].split("__")
            if a in weights and b in weights:
                scene["shape_" + name] = weights[a] * weights[b]
    scene["tint_Skin"] = linear_colour(colours["Skin"])
    scene["tint_Hair"] = linear_colour(colours["Hair"])
    for name in parts:
        if not name.startswith("clothing_"):
            continue
        short = name[9:]
        region = (
            "Trousers"
            if short in ("jeans", "shorts", "skirt")
            else "Shoes"
            if short in ("shoes", "boots")
            else "Undershirt"
            if short == "tshirt" and len(parts) > 4
            else "Top"
        )
        scene["tint_Cloth_" + short] = linear_colour(colours[region])
    for k in (
        "name",
        "age",
        "residentId",
        "personId",
        "agenda",
        "voice",
        "home",
        "occupation",
    ):
        rig[k] = person[k]
    txt = bpy.data.texts.new("Persona.json")
    txt.write(json.dumps(person, indent=2, ensure_ascii=False))
    txt.use_fake_user = True
    rig["personaText"] = txt.name
    scene["residentId"] = person["residentId"]
    bpy.context.view_layer.update()
    sculpt(rig, folder)
    custom_groom = apply_finishes(rig, folder)
    from casting_head import fit as fit_casting_head

    fit_casting_head(rig, folder)
    if fit.exists():
        reference_stance(rig, json.loads(fit.read_text()))
    from hand_details import add as add_hand_details

    add_hand_details(rig, folder)
    listening(rig, person)
    bpy.context.view_layer.update()
    if not custom_groom:
        groom(rig, person, colours)
    if review:
        studio(rig, folder)
    for lib in bpy.data.libraries:
        lib.filepath = "//" + os.path.relpath(LIB, folder)
    for img in bpy.data.images:
        if not img.library and img.filepath and Path(img.filepath).is_file():
            img.filepath = "//" + os.path.relpath(img.filepath, folder)
    bpy.ops.wm.save_as_mainfile(
        filepath=str(folder / "character.blend"), compress=True, relative_remap=False
    )


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--library", action="store_true")
    p.add_argument("--review", action="store_true")
    p.add_argument("ids", nargs="*")
    args = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    if args.library:
        library_build()
    for key in args.ids:
        create(ROOT / "Residents" / key, args.review)
