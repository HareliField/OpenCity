"""Fit the photographed fringe, directional crown bundles and coiled bun to the head."""

import math
import random

import bpy
import numpy as np
from mathutils import Vector


def hair_material(folder, filename):
    mat = bpy.data.materials.new(filename.split(".")[0])
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bs = nodes.get("Principled BSDF")
    bs.inputs["Roughness"].default_value = 0.72
    bs.inputs["Specular IOR Level"].default_value = 0.11
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(folder / filename), check_existing=True)
    tex.extension = "CLIP"
    for output, input in [("Color", "Base Color"), ("Alpha", "Alpha")]:
        mat.node_tree.links.new(tex.outputs[output], bs.inputs[input])
    return mat


def hair_mesh(name, rig, mat, coords, faces, uvs):
    from hero_finishes import anchored

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(coords, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(mat)
    uv = mesh.uv_layers.new(name="UVMap")
    for p in mesh.polygons:
        p.use_smooth = True
        for loop in p.loop_indices:
            uv.data[loop].uv = uvs[mesh.loops[loop].vertex_index]
    anchored(obj, rig, "head")
    obj.visible_shadow = False
    obj["runtimeHair"] = True
    return obj


def blend_fringe_at_temples(obj, coords):
    """Show the groom's side volume where the frontal strand plate is viewed edge-on."""
    mat = obj.data.materials[0]
    tree = mat.node_tree
    shader = tree.nodes.get("Principled BSDF")
    alpha = shader.inputs["Alpha"].links[0].from_socket
    coverage = np.clip((np.abs(coords[:, 0]) - 0.49) / 0.29, 0, 1)
    coverage *= np.clip((1.52 - coords[:, 1]) / 0.18, 0, 1)
    attribute = obj.data.attributes.new("Side groom coverage", "FLOAT", "POINT")
    attribute.data.foreach_set("value", coverage.astype("f"))
    edge = tree.nodes.new("ShaderNodeAttribute")
    edge.attribute_name = attribute.name
    axis = tree.nodes.new("ShaderNodeVectorTransform")
    axis.vector_type = "VECTOR"
    axis.convert_from = "OBJECT"
    axis.convert_to = "WORLD"
    axis.inputs[0].default_value = (0, -1, 0)
    incoming = tree.nodes.new("ShaderNodeNewGeometry")
    facing = tree.nodes.new("ShaderNodeVectorMath")
    facing.operation = "DOT_PRODUCT"
    tree.links.new(incoming.outputs["Incoming"], facing.inputs[0])
    tree.links.new(axis.outputs[0], facing.inputs[1])
    opacity = tree.nodes.new("ShaderNodeMapRange")
    opacity.interpolation_type = "SMOOTHSTEP"
    opacity.inputs["From Min"].default_value = 0.40
    opacity.inputs["From Max"].default_value = 0.82
    opacity.inputs["To Min"].default_value = 0.08
    tree.links.new(facing.outputs["Value"], opacity.inputs["Value"])
    mix = tree.nodes.new("ShaderNodeMixRGB")
    mix.inputs[1].default_value = (1, 1, 1, 1)
    tree.links.new(edge.outputs["Fac"], mix.inputs[0])
    tree.links.new(opacity.outputs[0], mix.inputs[2])
    multiply = tree.nodes.new("ShaderNodeMath")
    multiply.operation = "MULTIPLY"
    tree.links.new(alpha, multiply.inputs[0])
    tree.links.new(mix.outputs[0], multiply.inputs[1])
    tree.links.new(multiply.outputs[0], shader.inputs["Alpha"])


def side_lock_depth(front, fitted_depth, eye_span):
    """Give each photographed temple lock a smooth physical path around its ear."""
    height = front[:, 1]
    rows = np.unique(np.round(height, 5))
    offsets = np.arange(-15, 16, dtype=float)
    kernel = np.exp(-0.5 * (offsets / 5.0) ** 2)
    kernel /= kernel.sum()
    result = fitted_depth.copy()
    for sign in (-1, 1):
        lateral = sign * front[:, 0]
        root_band = (lateral > 0.81) & (lateral < 0.91)
        centres = np.full(len(rows), np.nan)
        for index, row in enumerate(rows):
            nearby = root_band & (np.abs(height - row) < 0.035)
            if np.any(nearby):
                centres[index] = np.median(fitted_depth[nearby])
        valid = np.isfinite(centres)
        if np.sum(valid) < 2:
            continue
        centres = np.interp(rows, rows[valid], centres[valid])
        centres = np.convolve(np.pad(centres, 15, mode="reflect"), kernel, mode="valid")
        # Preserve the poster's X and height. Its most lateral pixels used to
        # traverse the entire depth of the ear, stretching thin loose locks
        # into broad horizontal blades in three-quarter views.
        target = np.interp(height, rows, centres) + eye_span * (lateral - 0.86) * 0.25
        side = np.clip((lateral - 0.64) / 0.25, 0, 1)
        below_crown = np.clip((1.04 - height) / 0.51, 0, 1)
        influence = side**2 * (3 - 2 * side) * below_crown**2 * (3 - 2 * below_crown)
        result += influence * (target - fitted_depth)
    return result


def captured_groom(rig, folder, eye_height, eye_span):
    from hero_finishes import anchored
    from mathutils.bvhtree import BVHTree
    from portrait_surface import coordinates

    record = np.load(folder / "captured-hair.npz")
    scene = bpy.context.scene
    deps = bpy.context.evaluated_depsgraph_get()
    eyes = coordinates(scene.objects["Eyes"].evaluated_get(deps))
    xyz = record["coordinates"] * eye_span
    points = np.column_stack(
        (xyz[:, 0], eyes[:, 1].min() - xyz[:, 2], eye_height + xyz[:, 1])
    )
    body = BVHTree.FromObject(scene.objects["Body"], deps)
    # Keep the fringe and temple roots clear of the anatomical scalp underneath.
    for i in np.flatnonzero(
        (record["coordinates"][:, 2] > -0.57) & (record["normals"][:, 2] > 0.08)
    ):
        x, y, z = points[i]
        hit = body.ray_cast((x, -0.42, z), (0, 1, 0))[0]
        if hit is not None:
            points[i, 1] = hit.y - np.clip(
                hit.y - y, 0.0016, 0.009 + 0.006 * max(0.0, record["coordinates"][i, 1])
            )
    mesh = bpy.data.meshes.new("Captured fibre clumps")
    mesh.from_pydata(points.tolist(), [], record["triangles"].tolist())
    mesh.update()
    obj = bpy.data.objects.new("Captured bun, crown and fringe", mesh)
    scene.collection.objects.link(obj)
    mat = hair_material(folder, "captured-hair.png")
    mesh.materials.append(mat)
    uv = mesh.uv_layers.new(name="UVMap")
    corners = record["uv"].reshape(-1, 2).copy()
    corners[:, 1] = 1 - corners[:, 1]
    uv.data.foreach_set("uv", corners.ravel())
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    normals = record["normals"]
    mesh.normals_split_custom_set_from_vertices(
        np.column_stack((normals[:, 0], -normals[:, 2], normals[:, 1])).tolist()
    )
    anchored(obj, rig, "head")
    obj["runtimeHair"] = True
    obj.visible_shadow = False
    front = record["front"] * eye_span
    raised = np.column_stack(
        (front[:, 0], eyes[:, 1].min() - front[:, 2], eye_height + front[:, 1])
    )
    for i, (x, y, z) in enumerate(raised):
        hit = body.ray_cast((x, -0.42, z), (0, 1, 0))[0]
        if hit is not None:
            # A silhouette ray can suddenly hit the back of the ear. Push a
            # penetrating strand forward, keeping the measured depth for a
            # strand that already clears the skull.
            raised[i, 1] = min(y, hit.y - 0.0025)
    raised[:, 1] = side_lock_depth(record["front"], raised[:, 1], eye_span)
    front_uv = record["front_uv"].copy()
    front_uv[:, 1] = 1 - front_uv[:, 1]
    wisps = hair_mesh(
        "Loose temple wisps and captured fringe",
        rig,
        hair_material(folder, "frontal-locks.png"),
        raised.tolist(),
        record["front_triangles"].tolist(),
        front_uv.tolist(),
    )
    blend_fringe_at_temples(wisps, record["front"])
    return obj


def groom(rig, folder, ez, eye_span, center, use_capture):

    if use_capture:
        captured_groom(rig, folder, ez, eye_span)
        return
    rng = random.Random(folder.name + " layered hair")
    from hair_shape import profile, shell

    guide = np.load(folder / "groom-guide.npz")
    outline = profile(guide)

    # One smooth volumetric shell carries the fringe and intermediate-density
    # hairs. UV opacity reveals the forehead between individual flyaway locks.
    coords = []
    faces = []
    uvs = []
    cols = 109
    rows = 55
    from mathutils.bvhtree import BVHTree

    skull = BVHTree.FromObject(
        bpy.context.scene.objects["Body"], bpy.context.evaluated_depsgraph_get()
    )
    skull_center = Vector((0, -0.057, ez - 0.009))
    for j in range(rows):
        v = j / (rows - 1)
        for i in range(cols):
            u = i / (cols - 1)
            x, y, dz = shell((u - 0.5) * math.tau, v, eye_span, outline)
            point = Vector((x, y, ez + dz))
            longitude = (u - 0.5) * math.tau
            if math.cos(longitude) > 0:
                # A frontal ray adjusts only depth. Moving X or Z after solving
                # the texture projection displaces the photographed hairline.
                hit = skull.ray_cast((x, -0.42, ez + dz), (0, 1, 0))[0]
                if hit is not None:
                    loft = 0.004 + 0.007 * max(0, dz / eye_span) ** 1.2
                    point.y = min(point.y, hit.y - loft)
            else:
                delta = point - skull_center
                direction = delta.normalized()
                hit = skull.ray_cast(skull_center + direction * 0.28, -direction)[0]
                if hit is not None and (hit - skull_center).length < 0.19:
                    point = skull_center + direction * max(
                        delta.length, (hit - skull_center).length + 0.0031
                    )
            coords.append(tuple(point))
            uvs.append((u, 1 - v))
            if j and i:
                a = j * cols + i
                faces.append((a - cols - 1, a - 1, a, a - cols))
    hair_mesh(
        "Combed scalp and swept fringe",
        rig,
        hair_material(folder, "combed-hair.png"),
        coords,
        faces,
        uvs,
    )
    coords = []
    faces = []
    uvs = []

    def ribbon(points, normals, width):
        off = len(coords)
        tile = rng.randrange(8)
        for k, (p, n) in enumerate(zip(points, normals)):
            t = k / (len(points) - 1)
            tangent = points[min(k + 1, len(points) - 1)] - points[max(0, k - 1)]
            lateral = tangent.cross(n).normalized()
            half = (
                width * (0.86 + 0.14 * math.sin(math.pi * t)) * (1 - 0.60 * t**3) * 0.5
            )
            for side in (-1, 0, 1):
                coords.append(
                    tuple(p + lateral * (half * side) + n * 0.0013 * (1 - abs(side)))
                )
                uvs.append(((tile + (side + 1) * 0.5) / 8, 1 - t))
            if k:
                b = off + 3 * k
                faces.extend([(b - 3, b - 2, b + 1, b), (b - 2, b - 1, b + 2, b + 1)])

    # Narrow swept ribbons over the side/back silhouette provide depth around the
    # ears. The translucent material combines several fibres per strip.
    for _ in range(92):
        a = rng.choice([-1, 1]) * rng.uniform(1.32, 3.05)
        side = np.sign(a)
        t0 = rng.uniform(0.32, 0.86)
        dt = rng.uniform(0.13, 0.29)
        points = []
        ns = []
        for k in range(12):
            f = k / 11
            ang = a + side * 0.40 * f
            t = t0 + dt * f
            x, y, z = shell(ang, min(t, 1.03), eye_span, outline)
            n = Vector((float(x), float(y + 0.057), float(z))).normalized()
            p = Vector((float(x), float(y), ez + float(z)))
            points.append(p + n * (0.001 + 0.0018 * math.sin(math.pi * f)))
            ns.append(n)
        ribbon(points, ns, rng.uniform(0.003, 0.007))
    for _ in range(56):
        a = rng.choice((-1, 1)) * rng.uniform(1.35, 2.85)
        start = rng.uniform(0.11, 0.65)
        finish = min(1.02, start + rng.uniform(0.30, 0.46))
        bend = rng.uniform(-0.18, 0.18)
        phase = rng.uniform(0, 6)
        sign = 1 if a > -0.35 else -1
        points = []
        ns = []
        for k in range(14):
            f = k / 13
            ang = (
                a
                + sign * 0.36 * f
                + bend * math.sin(math.pi * f)
                + 0.023 * math.sin(f * 8 + phase)
            )
            x, y, z = shell(ang, start * (1 - f) + finish * f, eye_span, outline)
            n = Vector((float(x), float(y + 0.057), float(z))).normalized()
            p = Vector((float(x), float(y), ez + float(z)))
            points.append(
                p
                + n
                * (0.001 + (0.0028 + 0.002 * math.sin(phase)) * math.sin(math.pi * f))
            )
            ns.append(n)
        ribbon(points, ns, rng.uniform(0.0014, 0.0027))
    for side in (-1, 1):
        for _ in range(12 if side == -1 else 15):
            length = rng.uniform(0.052, 0.128)
            x0 = side * rng.uniform(0.078, 0.093)
            y0 = rng.uniform(-0.094, -0.057)
            phase = rng.uniform(0, math.tau)
            extent = rng.uniform(0.003, 0.013)
            points = []
            ns = []
            for k in range(14):
                t = k / 13
                x = x0 + side * (
                    extent * math.sin(math.pi * t) + 0.002 * math.sin(t * 7 + phase)
                )
                y = y0 + 0.021 * t + 0.0045 * math.sin(5 * t + phase)
                points.append(Vector((x, y, ez + 0.029 - length * t)))
                ns.append(Vector((side * 0.75, -0.65, 0)).normalized())
            ribbon(points, ns, rng.uniform(0.00075, 0.0021))
    # Sparse escaped wisps change the outline without hard strips at the fringe.
    for side in (-1, 1):
        for _ in range(24):
            a = side * rng.uniform(0.90, 1.65)
            start = rng.uniform(0.34, 0.56)
            phase = rng.uniform(0, math.tau)
            points = []
            ns = []
            for k in range(12):
                f = k / 11
                x, y, z = shell(
                    a + side * 0.40 * f, start + 0.34 * f, eye_span, outline
                )
                n = Vector((float(x), float(y + 0.057), float(z))).normalized()
                p = Vector((float(x), float(y), ez + float(z)))
                points.append(
                    p
                    + n
                    * (
                        0.001
                        + 0.011 * math.sin(math.pi * f) * (0.6 + 0.4 * math.sin(phase))
                    )
                )
                ns.append(n)
            ribbon(points, ns, rng.uniform(0.0007, 0.0016))
    # Rear knot receives continuous helical bundles, with varying phase and thickness.
    bun = Vector(center)
    for _ in range(160):
        angle = rng.uniform(-math.pi, math.pi)
        lat = rng.uniform(-1.4, 1.4)
        radius = rng.uniform(0.93, 1.07)
        sweep = rng.uniform(1.2, 2.5)
        points = []
        ns = []
        for k in range(13):
            t = k / 12
            a = angle + sweep * t
            l = lat + 0.19 * math.sin(a + 0.55)
            n = Vector(
                (math.cos(a) * math.cos(l), math.sin(a) * math.cos(l), math.sin(l))
            )
            points.append(
                bun + Vector((0.045 * n.x, 0.043 * n.y, 0.045 * n.z)) * radius
            )
            ns.append(n)
        ribbon(points, ns, rng.uniform(0.009, 0.020))
    hair_mesh(
        "Loose temple and coiled bun cards",
        rig,
        hair_material(folder, "hair-fibres.png"),
        coords,
        faces,
        uvs,
    )
