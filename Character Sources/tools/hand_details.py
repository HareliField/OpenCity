"""Fit ten short, unpolished nail plates to the resident's shaped hand surfaces."""

import json
import math

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree


def swatches(folder, samples):
    image = bpy.data.images.load(str(folder / "reference.jpg"), check_existing=True)
    w, h = image.size
    pixels = np.empty(w * h * 4, dtype="f")
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(h, w, 4)[::-1, :, :3]
    return {
        name: np.median(
            np.concatenate(
                [
                    pixels[
                        int(y * h) - 3 : int(y * h) + 4, int(x * w) - 3 : int(x * w) + 4
                    ].reshape(-1, 3)
                    for x, y in points
                ]
            ),
            axis=0,
        )
        for name, points in samples.items()
    }


def hues(folder, samples):
    source = swatches(folder, samples)
    # Blender returns stored byte-image pixels in sRGB; vertex colours are linear.
    color = {
        key: np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
        for key, rgb in source.items()
    }
    bed = np.clip(color["nails"] * 0.88 + color["skin"] * 0.12, 0, 1)
    # Remove the studio light-level difference; retain the hue shift of the joints.
    knuckle = color["knuckles"] / np.maximum(color["skin"], 0.015)
    knuckle /= max(0.1, np.mean(knuckle))
    tint = np.clip(knuckle * 0.90, 0.68, 0.99)
    return bed, tint


def evaluated_skin(body):
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    evaluated.calc_loop_triangles()
    pts = np.empty(len(evaluated.vertices) * 3, dtype="f")
    evaluated.vertices.foreach_get("co", pts)
    pts = pts.reshape(-1, 3)
    triangles = np.asarray(
        [tri.vertices[:] for tri in evaluated.loop_triangles], dtype=int
    )
    return evaluated, pts, triangles


def swatch_map(body, mesh, points, triangles, rig, rgb):
    """Tint the dorsal knuckles in the body's existing atlas, leaving its linked mesh shared."""
    shade = np.zeros(len(points), "f")
    bones = rig.data.bones
    for side, sign in (("l", 1), ("r", -1)):
        direction = (
            bones["middle_01_" + side].head_local - bones["hand_" + side].head_local
        )
        across = (
            bones["pinky_01_" + side].head_local - bones["index_01_" + side].head_local
        )
        dorsal = np.asarray(direction.cross(across).normalized() * sign)
        for digit in ("thumb", "index", "middle", "ring", "pinky"):
            for seg, length, width in (("01", 0.012, 0.016), ("02", 0.008, 0.013)):
                bone = bones[digit + "_" + seg + "_" + side]
                group = body.vertex_groups.get(bone.name)
                if not group:
                    continue
                ids = np.array(
                    [
                        v.index
                        for v in mesh.vertices
                        if any(
                            g.group == group.index and g.weight > 0.06 for g in v.groups
                        )
                    ]
                )
                if not len(ids):
                    continue
                p = points[ids]
                along = np.asarray((bone.tail_local - bone.head_local).normalized())
                tick = p @ along
                # Rest joints are retargeted to the cast body. Locate the painted ridge
                # from the actual proximal ring of vertices and the outward hand surface.
                near = tick < np.quantile(tick, 0.30)
                local = p[near]
                elevations = local @ dorsal
                center = local[elevations >= np.quantile(elevations, 0.55)].mean(axis=0)
                diff = p - center
                long = diff @ along
                radius = np.linalg.norm(diff - long[:, None] * along, axis=1)
                strength = np.exp(-0.5 * ((long / length) ** 2 + (radius / width) ** 2))
                shade[ids] = np.maximum(shade[ids], strength.astype("f"))
    layer = mesh.uv_layers.get("UVMap")
    if not layer or not shade.any():
        return
    size = 512
    coverage = np.zeros((size, size), dtype="f")
    for tri, ids in zip(mesh.loop_triangles, triangles):
        if shade[ids].max() < 0.03:
            continue
        uv = np.asarray([layer.data[i].uv[:] for i in tri.loops]) * size - 0.5
        low = np.maximum(0, np.floor(uv.min(axis=0)).astype(int))
        high = np.minimum(size - 1, np.ceil(uv.max(axis=0)).astype(int))
        if (high < low).any():
            continue
        x0, y0 = low
        x1, y1 = high
        yy, xx = np.mgrid[y0 : y1 + 1, x0 : x1 + 1]
        ux, uy = uv[1] - uv[0]
        vx, vy = uv[2] - uv[0]
        den = ux * vy - uy * vx
        if abs(den) < 1e-6:
            continue
        dx, dy = xx - uv[0, 0], yy - uv[0, 1]
        b = (dx * vy - dy * vx) / den
        c = (ux * dy - uy * dx) / den
        a = 1 - b - c
        fill = np.where(
            (a >= 0) & (b >= 0) & (c >= 0),
            a * shade[ids[0]] + b * shade[ids[1]] + c * shade[ids[2]],
            0,
        )
        patch = coverage[y0 : y1 + 1, x0 : x1 + 1]
        np.maximum(patch, fill, out=patch)
    pixels = np.ones((size, size, 4), dtype="f")
    pixels[:, :, :3] += coverage[:, :, None] * (rgb - 1)
    texture = bpy.data.images.new(
        "Knuckle colour from casting photo", width=size, height=size, alpha=False
    )
    texture.colorspace_settings.name = "Non-Color"
    texture.pixels.foreach_set(pixels.ravel())
    texture.pack()
    slot = body.material_slots[0]
    if slot.material.library:
        material = slot.material.copy()
        slot.link = "OBJECT"
        slot.material = material
    nodes = slot.material.node_tree
    shader = next(n for n in nodes.nodes if n.type == "BSDF_PRINCIPLED")
    color = shader.inputs["Base Color"]
    multiply = nodes.nodes.new("ShaderNodeMixRGB")
    multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 0.78
    if color.links:
        nodes.links.new(color.links[0].from_socket, multiply.inputs[1])
    else:
        multiply.inputs[1].default_value = color.default_value
    img = nodes.nodes.new("ShaderNodeTexImage")
    img.image = texture
    uv = nodes.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    nodes.links.new(uv.outputs["UV"], img.inputs["Vector"])
    nodes.links.new(img.outputs["Color"], multiply.inputs[2])
    nodes.links.new(multiply.outputs[0], color)


def nail_patch(body, mesh, points, triangles, rig, digit, side, tone):
    bones = rig.data.bones
    distal = bones[digit + "_03_" + side]
    direction = (distal.tail_local - distal.head_local).normalized()
    palm = bones["middle_01_" + side].head_local - bones["hand_" + side].head_local
    across = bones["pinky_01_" + side].head_local - bones["index_01_" + side].head_local
    dorsal = palm.cross(across).normalized() * (1 if side == "l" else -1)
    if digit == "thumb":
        radial = (
            bones["thumb_01_" + side].head_local - bones["index_01_" + side].head_local
        ).normalized()
        dorsal = (0.78 * radial + 0.52 * dorsal).normalized()
    normal = (dorsal - direction * direction.dot(dorsal)).normalized()
    lateral = direction.cross(normal).normalized()
    members = {
        body.vertex_groups[n].index
        for n in (digit + "_02_" + side, digit + "_03_" + side)
    }
    mask = np.array(
        [
            sum(g.weight for g in v.groups if g.group in members) > 0.48
            for v in mesh.vertices
        ]
    )
    local = triangles[np.any(mask[triangles], axis=1)]
    bvh = BVHTree.FromPolygons(points.tolist(), local.tolist(), all_triangles=True)
    relative = points[mask] - np.asarray(distal.head_local)
    longitudinal = relative @ np.asarray(direction)
    sideways = relative @ np.asarray(lateral)
    tip = float(longitudinal.max())
    length = {
        "thumb": 0.015,
        "index": 0.0115,
        "middle": 0.013,
        "ring": 0.0118,
        "pinky": 0.009,
    }[digit]
    end = tip - 0.0022
    start = end - length
    middle_band = (longitudinal > start + 0.1 * length) & (
        longitudinal < end - 0.1 * length
    )
    edges = np.quantile(sideways[middle_band], [0.035, 0.965])
    center = np.mean(edges)
    half_width = 0.345 * (edges[1] - edges[0])
    verts, weights, colors, faces = [], [], [], []
    for row, v in enumerate(
        (0.0, 0.07, 0.17, 0.31, 0.48, 0.65, 0.80, 0.91, 0.956, 1.0)
    ):
        for col, u in enumerate(np.linspace(-1, 1, 9)):
            t = start + length * v + u * u * 0.00205 * (1 - 2 * v)
            edge_scale = 0.78 + 0.21 * math.sin(v * math.pi)
            span = half_width * u * edge_scale
            origin = (
                distal.head_local
                + direction * float(t)
                + lateral * float(center + span)
                + 0.050 * normal
            )
            hit, surface, face, _ = bvh.ray_cast(origin, -normal, 0.12)
            if hit is None:
                raise ValueError(f"Unable to seat {digit}_{side} nail at {row}, {col}")
            ids = local[face]
            a, b, c = points[ids]
            coeff = np.linalg.lstsq(
                np.column_stack((b - a, c - a)), np.asarray(hit) - a, rcond=None
            )[0]
            influence = {}
            for index, factor in zip(ids, (1 - coeff.sum(), *coeff)):
                for g in mesh.vertices[int(index)].groups:
                    name = body.vertex_groups[g.group].name
                    if name.startswith(digit + "_") and name.endswith("_" + side):
                        influence[name] = (
                            influence.get(name, 0) + max(0.0, factor) * g.weight
                        )
            total = sum(influence.values())
            weights.append(
                {name: w / total for name, w in influence.items()}
                if total
                else {distal.name: 1.0}
            )
            dome = 0.00012 + 0.00022 * (1 - u * u) * math.sin(v * math.pi)
            verts.append(tuple(hit + surface * float(dome)))
            # Only the outermost half millimetre carries the unpolished free margin.
            edge = max(0.0, (v - 0.945) / 0.055)
            blood = math.sin(math.pi * v)
            bed = tone * np.array(
                (0.91 + 0.07 * blood, 0.88 + 0.065 * blood, 0.90 + 0.07 * blood)
            )
            crescent = max(0.0, 1 - v / 0.16) * (1 - u * u)
            bed *= 1 + 0.04 * crescent
            colors.append(
                (
                    *np.clip(
                        bed * (1 - 0.27 * edge)
                        + (0.67, 0.54, 0.48) * np.asarray(0.27 * edge),
                        0,
                        1,
                    ),
                    1.0,
                )
            )
            if row and col:
                i = row * 9 + col
                # lateral cross longitudinal points outwards.
                faces.append((i - 10, i - 9, i, i - 1))
    return verts, faces, weights, colors


def add(rig, folder):
    path = folder / "art-direction.json"
    recipe = json.loads(path.read_text()).get("handDetails") if path.exists() else None
    if not recipe or recipe.get("cut") != "short unpolished":
        return
    scene = bpy.context.scene
    body = scene.objects["Body"]
    old_pose = rig.data.pose_position
    try:
        rig.data.pose_position = "REST"
        bpy.context.view_layer.update()
        mesh, points, tris = evaluated_skin(body)
        tone, tint = hues(folder, recipe["swatches"])
        verts, faces, groups, colors = [], [], [], []
        for side in "lr":
            for digit in ("thumb", "index", "middle", "ring", "pinky"):
                v, f, w, c = nail_patch(
                    body, mesh, points, tris, rig, digit, side, tone
                )
                off = len(verts)
                faces.extend(tuple(i + off for i in poly) for poly in f)
                verts.extend(v)
                groups.extend(w)
                colors.extend(c)
        geo = bpy.data.meshes.new("Ten short nail plates")
        geo.from_pydata(verts, [], faces)
        geo.update()
        nails = bpy.data.objects.new("Short natural nails", geo)
        scene.collection.objects.link(nails)
        nails.parent = rig
        for vertex, ws in enumerate(groups):
            for key, w in ws.items():
                group = nails.vertex_groups.get(key) or nails.vertex_groups.new(
                    name=key
                )
                group.add([vertex], float(w), "REPLACE")
        modifier = nails.modifiers.new("Finger articulation", "ARMATURE")
        modifier.object = rig
        geo.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=bool))
        attr = geo.color_attributes.new(
            name="Nail tone", type="FLOAT_COLOR", domain="POINT"
        )
        attr.data.foreach_set("color", np.asarray(colors, dtype="f").ravel())
        mat = bpy.data.materials.new("Unpolished nail keratin")
        mat.use_nodes = True
        nt = mat.node_tree
        shader = nt.nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = 0.40
        shader.inputs["Coat Weight"].default_value = 0.12
        attrnode = nt.nodes.new("ShaderNodeVertexColor")
        attrnode.layer_name = "Nail tone"
        nt.links.new(attrnode.outputs["Color"], shader.inputs["Base Color"])
        geo.materials.append(mat)
        swatch_map(body, mesh, points, tris, rig, tint)
    finally:
        rig.data.pose_position = old_pose
        bpy.context.view_layer.update()
