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
    bs.inputs["Roughness"].default_value = 0.61
    bs.inputs["Specular IOR Level"].default_value = 0.18
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


def groom(rig, folder, ez, eye_span, center):

    rng = random.Random(folder.name + " layered hair")
    from hair_shape import shell

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
            x, y, dz = shell((u - 0.5) * math.tau, v, eye_span)
            point = Vector((x, y, ez + dz))
            if math.cos((u - 0.5) * math.tau) < 0.36:
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
            x, y, z = shell(ang, min(t, 1.03), eye_span)
            n = Vector((float(x), float(y + 0.057), float(z))).normalized()
            p = Vector((float(x), float(y), ez + float(z)))
            points.append(p + n * (0.001 + 0.0018 * math.sin(math.pi * f)))
            ns.append(n)
        ribbon(points, ns, rng.uniform(0.003, 0.007))
    for _ in range(115):
        a = rng.uniform(-2.7, 2.7)
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
            x, y, z = shell(ang, start * (1 - f) + finish * f, eye_span)
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
        for _ in range(14 if side == -1 else 20):
            length = rng.uniform(0.070, 0.175)
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
                x, y, z = shell(a + side * 0.40 * f, start + 0.34 * f, eye_span)
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
