"""Reconstruct an editable facial surface from the registered 3D casting landmarks."""

from functools import lru_cache
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree
from portrait_surface import coordinates

ROOT = Path(__file__).resolve().parents[1]


@lru_cache(None)
def topology():
    rows = (ROOT / "Anatomy" / "face-topology.obj").read_text().splitlines()
    return [
        tuple(int(s.split("/")[0]) - 1 for s in line.split()[1:])
        for line in rows
        if line.startswith("f ")
    ]


def face_material(photo, gloss=False):
    mat = bpy.data.materials.new(
        "Photographic cornea" if gloss else "Photographic facial skin"
    )
    mat.use_nodes = True
    nt = mat.node_tree
    bs = nt.nodes.get("Principled BSDF")
    texture = nt.nodes.new("ShaderNodeTexImage")
    texture.image = photo
    nt.links.new(texture.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.21 if gloss else 0.55
    if not gloss:
        bs.inputs["Subsurface Weight"].default_value = 0.065
        bs.inputs["Subsurface Scale"].default_value = 0.0013
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 460
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.11
        bump.inputs["Distance"].default_value = 0.00014
        nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bs.inputs["Normal"])
    return mat


def sculpt(rig, folder):
    path = folder / "face-sculpt.bin"
    if not path.exists():
        return
    fit = json.loads((folder / "photo-fit.json").read_text())
    marks = np.fromfile(path, dtype="<f4").reshape(468, 3)
    w, h = fit["sourcePixels"]
    image = marks * np.array([w, h, w])
    scene = bpy.context.scene
    deps = bpy.context.evaluated_depsgraph_get()
    eyes = next(o for o in scene.objects if o.name == "Eyes")
    eye_pts = coordinates(eyes.evaluated_get(deps))
    eyez = (eye_pts[:, 2].max() + eye_pts[:, 2].min()) * 0.5
    span = (eye_pts[:, 0].max() - eye_pts[:, 0].min()) * 0.97
    center = (image[33] + image[263]) * 0.5
    scale = span / max(1, image[263, 0] - image[33, 0])
    x = (image[:, 0] - center[0]) * scale
    z = eyez - (image[:, 1] - center[1]) * scale
    predicted = eye_pts[:, 1].min() + 0.0005 + (image[:, 2] - center[2]) * scale
    body_tree = BVHTree.FromObject(
        next(o for o in scene.objects if o.name == "Body"), deps
    )
    vertices = []
    for px, py, pz in zip(x, predicted, z):
        hit, _, _, _ = body_tree.ray_cast((px, -1, pz), (0, 1, 0))
        if hit:
            # Preserve the photographed depth and join the patch to the underlying skin.
            front = py + 0.28 * float(np.clip(hit.y - py, -0.009, 0.009)) - 0.0011
        else:
            front = py
        vertices.append((px, front, pz))
    faces = topology().copy()
    # Suppress depth spikes around a closed mouth where the scan and dress form overlap.
    depth = np.array([p[1] for p in vertices])
    adj = [set() for _ in vertices]
    for a, b, c in faces:
        adj[a].update((b, c))
        adj[b].update((a, c))
        adj[c].update((a, b))
    lips = (
        (np.abs(x) < span * 0.41) & (z < eyez - span * 0.42) & (z > eyez - span * 0.91)
    )
    for _ in range(4):
        softened = depth.copy()
        for i in np.flatnonzero(lips):
            if adj[i]:
                softened[i] = 0.5 * depth[i] + 0.5 * np.mean(depth[list(adj[i])])
        depth = softened
    vertices = [
        (float(x[i]), float(depth[i]), float(z[i])) for i in range(len(vertices))
    ]

    detail = folder / "skin-uv.bin"
    texcoords = (
        np.fromfile(detail, dtype="<f4").reshape(468, 2)
        if detail.exists()
        else marks[:, :2]
    )
    uv = [(float(u), float(1 - v)) for u, v in texcoords]
    mesh = bpy.data.meshes.new("Landmark facial sculpt")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Measured face", mesh)
    scene.collection.objects.link(obj)
    photo = bpy.data.images.load(
        str(folder / ("skin-reference.jpg" if detail.exists() else "reference.jpg")),
        check_existing=True,
    )
    mesh.materials.append(face_material(photo))
    mesh.materials.append(face_material(photo, True))
    left_eye = {
        33,
        7,
        163,
        144,
        145,
        153,
        154,
        155,
        133,
        173,
        157,
        158,
        159,
        160,
        161,
        246,
    }
    right_eye = {
        362,
        382,
        381,
        380,
        374,
        373,
        390,
        249,
        263,
        466,
        388,
        387,
        386,
        385,
        384,
        398,
    }
    mapping = mesh.uv_layers.new(name="Photograph")
    for poly in mesh.polygons:
        poly.use_smooth = True
        ids = set(poly.vertices)
        poly.material_index = int(ids <= left_eye or ids <= right_eye)
        for loop in poly.loop_indices:
            mapping.data[loop].uv = uv[mesh.loops[loop].vertex_index]
    # The canonical surface includes both eyelids, lips and the neutral eyes.
    for name in ("Eyes", "Eyebrows", "Eyelashes"):
        base = scene.objects.get(name)
        if base:
            base.hide_render = True
    skin = next(
        slot.material
        for slot in scene.objects["Body"].material_slots
        if slot.material and slot.material.use_nodes
    )
    nt = skin.node_tree
    output = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    if output.inputs["Surface"].links:
        original = output.inputs["Surface"].links[0].from_socket
        coverage = nt.nodes.new("ShaderNodeVertexColor")
        coverage.layer_name = "Face detail coverage"
        threshold = nt.nodes.new("ShaderNodeMath")
        threshold.operation = "GREATER_THAN"
        threshold.inputs[1].default_value = 0.94
        nt.links.new(coverage.outputs["Color"], threshold.inputs[0])
        transparent = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(threshold.outputs[0], mix.inputs[0])
        nt.links.new(original, mix.inputs[1])
        nt.links.new(transparent.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], output.inputs["Surface"])
    rest_shape = obj.shape_key_add(name="Measured resting face")
    brow = obj.shape_key_add(name="Listening brow lift")
    for i in range(468):
        co = rest_shape.data[i].co
        center_x = -span * 0.32
        influence = np.exp(
            -(((co.x - center_x) / (0.23 * span)) ** 2)
            - ((co.z - (eyez + 0.013)) / (0.105 * span)) ** 2
        )
        brow.data[i].co.z += 0.0045 * float(influence)
    for frame, value in [(1, 0), (26, 1), (48, 0)]:
        brow.value = value
        brow.keyframe_insert(data_path="value", frame=frame)
    bpy.context.scene.frame_set(1)
    sub = obj.modifiers.new("Facial surface subdivision", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 2
    rest = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = "head"
    bpy.context.view_layer.update()
    obj.matrix_world = rest
    obj["landmarks"] = 468
    obj["source"] = folder.name + "/reference.jpg"
