"""Cut Ida's soft hood, elastic cuffs and crew-neck rib on the fitted garments."""

import json
import math

import bmesh
import bpy
import numpy as np
from build_cast import linear_colour
from mathutils import Vector
from mathutils.kdtree import KDTree
from portrait_surface import smoothstep


def shape_shell(points, normals, rig):
    scale = rig.data.bones["neck_01"].head_local.z / 1.622
    x, y, z = (points / scale).T.copy()
    opening = np.exp(-(((abs(x) - 0.035) / 0.055) ** 2)) * smoothstep(-0.05, -0.13, y)
    points[:, 0] += np.sign(x) * opening * 0.015 * scale
    # The shell stands away from the elastic casing, then gathers back into it.
    waist = np.exp(-(((z - 1.03) / 0.057) ** 2)) * (abs(x) < 0.228)
    hem = smoothstep(1.023, 0.961, z) * (abs(x) < 0.228)
    points[:, 0] *= 1 - 0.080 * hem
    relief = (
        waist * (0.009 + 0.004 * np.sin(82 * x + 16 * y))
        + 0.003 * np.sin(115 * x + 43 * y) * hem
    )
    chest = np.exp(
        -(((abs(x) - 0.15) / 0.085) ** 2) - ((z - 1.275) / 0.16) ** 2
    ) * smoothstep(0.025, -0.12, y)
    relief += 0.005 * chest * np.cos(67 * z + np.sin(12 * x) + 32 * abs(x))
    points += normals * (scale * relief[:, None])
    from mathutils.bvhtree import BVHTree

    body = bpy.context.scene.objects["Body"]
    skin = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    for side, sign in [("l", 1), ("r", -1)]:
        joint = rig.data.bones["lowerarm_" + side]
        wrist = np.array(joint.tail_local)
        axis = np.asarray((joint.tail_local - joint.head_local).normalized())
        offset = points - wrist
        along = (offset @ axis) / scale
        radial = offset - along[:, None] * scale * axis
        sleeve = sign * x > 0.345
        draw = smoothstep(-0.039, 0.002, along) * sleeve
        bunch = np.exp(-(((along + 0.057) / 0.036) ** 2)) * sleeve
        points += (
            radial
            * (-0.32 * draw + bunch * (0.11 + 0.11 * np.cos(116 * along + 9 * z)))[
                :, None
            ]
        )
        # Fit the last palm-length of sleeve to the actual forearm cross-section.
        # The baggier mid-sleeve still has room for the diagonal gathered folds.
        for i in np.flatnonzero(sleeve & (along > -0.16) & (along < 0.040)):
            center = wrist + axis * along[i] * scale
            radial = points[i] - center
            radius = np.linalg.norm(radial)
            if radius < 0.001:
                continue
            d = radial / radius
            hit = skin.ray_cast(
                Vector(center + 0.23 * scale * d), Vector(-d), 0.28 * scale
            )[0]
            if hit is None:
                continue
            skin_radius = np.dot(np.array(hit) - center, d)
            if skin_radius <= 0:
                continue
            ease = 0.0055 + 0.012 * smoothstep(-0.018, -0.116, along[i])
            excess = max(0, radius - skin_radius - ease * scale)
            points[i] -= d * excess * smoothstep(-0.16, -0.085, along[i])
        # The gathered casing ends above the moving hand; keep the palm clear on the floor.
        points -= (
            axis * (0.025 * smoothstep(-0.065, -0.001, along) * sleeve * scale)[:, None]
        )


def cloth_mesh(name, vertices, faces, materials, slots):
    mesh = bpy.data.meshes.new(name + " pattern")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for mat in materials:
        mesh.materials.append(mat)
    for poly, slot in zip(mesh.polygons, slots):
        poly.use_smooth = True
        poly.material_index = slot
    mesh.uv_layers.new(name="UVMap")
    return obj


def folded_hood(rig, folder):
    from hero_finishes import anchored, finish_material

    s = rig.data.bones["neck_01"].head_local.z / 1.622
    dye = linear_colour(
        json.loads((folder / "photo-fit.json").read_text())["colours"]["Top"]
    )[:3]
    mat = finish_material("Faded windbreaker hood", dye, 0.81)
    # Measured along the front opening, clavicle, nape, and rear fall of the hood.
    inside = np.array(
        [
            [0.046, -0.156, 1.490],
            [0.054, -0.142, 1.525],
            [0.062, -0.127, 1.551],
            [0.071, -0.105, 1.583],
            [0.081, -0.078, 1.608],
            [0.077, -0.029, 1.631],
            [0.067, 0.028, 1.643],
            [0.043, 0.067, 1.650],
            [0, 0.076, 1.651],
        ]
    )
    outside = np.array(
        [
            [0.060, -0.157, 1.485],
            [0.077, -0.145, 1.521],
            [0.122, -0.141, 1.535],
            [0.145, -0.124, 1.558],
            [0.157, -0.094, 1.582],
            [0.166, -0.039, 1.603],
            [0.162, 0.040, 1.593],
            [0.131, 0.111, 1.482],
            [0, 0.165, 1.438],
        ]
    )

    def mirror(p):
        a = p[-2::-1].copy()
        a[:, 0] *= -1
        return np.concatenate((p, a))

    def spline(p, t):
        # Sample the pattern stations with a uniform Catmull–Rom curve.
        a = int(t)
        u = t - a
        p0, p1, p2, p3 = (
            p[max(0, a - 1)],
            p[a],
            p[min(a + 1, len(p) - 1)],
            p[min(a + 2, len(p) - 1)],
        )
        return 0.5 * (
            (2 * p1)
            + (-p0 + p2) * u
            + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
            + (-p0 + 3 * p1 - 3 * p2 + p3) * u**3
        )

    inside, outside = mirror(inside), mirror(outside)
    vertices = []
    faces = []
    along = 97
    across = 17
    for i, t in enumerate(np.linspace(0, len(inside) - 1, along)):
        a, b = spline(inside, t), spline(outside, t)
        bend = min(t, len(inside) - 1 - t)
        # The two sewn ends meet the zip. The rear drops in soft transverse folds.
        amp = min(1, bend / 2)
        front = 1 - np.clip((bend - 4) / 3, 0, 1)
        for j, u in enumerate(np.linspace(0, 1, across)):
            q = a * (1 - u) + b * u
            ridge = (
                np.sin(np.pi * u)
                * (0.010 + 0.007 * np.cos(3 * np.pi * u + 0.42 * t))
                * amp
            )
            q[2] += (
                ridge - 0.0065 * np.sin(5 * np.pi * u + 0.15 * t) * (1 - front) * amp
            )
            q[1] += ridge * (0.73 - 1.28 * front)
            q[2] += (0.0045 * np.sin(0.73 * t) + 0.002 * np.sin(3.2 * t)) * amp * u
            q[1] -= 0.004 * np.sin(np.pi * u) * np.sin(1.7 * t) * front
            q[2] += (
                0.0034
                * np.cos(5 * np.pi * u)
                * np.exp(-(((u - 0.18) / 0.22) ** 2))
                * amp
            )
            vertices.append(q * s)
            if i and j:
                k = i * across + j
                faces.append((k - across - 1, k - 1, k, k - across))
    hood = cloth_mesh(
        "Folded windbreaker hood", vertices, faces, [mat], [0] * len(faces)
    )
    # Lay the rolled pattern along the warp, including the visible sleeve-worn dye.
    uv = hood.data.uv_layers["UVMap"]
    for poly in hood.data.polygons:
        for li in poly.loop_indices:
            row, col = divmod(hood.data.loops[li].vertex_index, across)
            uv.data[li].uv = (row / (along - 1), col / (across - 1) * 0.47)
    from hero_materials import material

    if (folder / "windbreaker-albedo.jpg").is_file():
        material(hood, folder, "windbreaker", "UVMap")
    shell = hood.modifiers.new("Bound shell thickness", "SOLIDIFY")
    shell.thickness = 0.0016 * s
    anchored(hood, rig, "spine_03")


def boundaries(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00007)
    open_edges = {edge for edge in bm.edges if edge.is_boundary}
    rings = []
    while open_edges:
        first = open_edges.pop()
        todo = [first]
        ring = {first}
        while todo:
            for v in todo.pop().verts:
                new = set(v.link_edges) & open_edges
                open_edges.difference_update(new)
                ring.update(new)
                todo.extend(new)
        rings.append(np.array([v.co[:] for v in {v for e in ring for v in e.verts}]))
    bm.free()
    return rings


def knitted_edges(jacket, shirt, rig, folder):
    from hero_finishes import finish_material

    s = rig.data.bones["neck_01"].head_local.z / 1.622
    dye = linear_colour(
        json.loads((folder / "photo-fit.json").read_text())["colours"]["Top"]
    )[:3]
    shell = finish_material(
        "Elasticated shell casing", tuple(v * 0.83 for v in dye), 0.89
    )
    trim = finish_material(
        "Gray melange crew-neck rib", linear_colour("#676567")[:3], 0.90
    )
    points = []
    faces = []
    slots = []
    bindings = []
    from mathutils.bvhtree import BVHTree

    jacket_surface = BVHTree.FromObject(jacket, bpy.context.evaluated_depsgraph_get())

    def band(src, row, direction, outward, mat, width, channels):
        # Resample the actual opening. Its outline follows the fitted garment.
        dist = np.r_[0, np.cumsum(np.linalg.norm(np.diff(row, axis=0), axis=1))]
        length = dist[-1]
        ns = channels * 4 + 1
        frames = 5
        tree = KDTree(len(src.data.vertices))
        for vert in src.data.vertices:
            tree.insert(vert.co, vert.index)
        tree.balance()
        start = len(points)
        for i, v in enumerate(np.linspace(0, length, ns)):
            q = np.array([np.interp(v, dist, c) for c in row.T])
            tangent = direction(q)
            normal = outward(q)
            rad = (0.00042 + 0.0006 * (0.5 + 0.5 * math.cos(math.tau * i / 4))) * s
            for j, t in enumerate(np.linspace(0, 1, frames)):
                relief = (
                    rad * np.sin(t * np.pi)
                    + (0.0013 + 0.0011 * np.cos(math.tau * t)) * s
                )
                p = q + tangent * (t * width * s)
                if src == jacket:
                    hit = jacket_surface.ray_cast(
                        Vector(p + 0.085 * s * normal), Vector(-normal), 0.115 * s
                    )[0]
                    if (
                        hit is not None
                        and np.linalg.norm(np.asarray(hit) - p) < 0.034 * s
                    ):
                        p = np.asarray(hit)
                p = p + normal * relief
                points.append(p)
                original = src.data.vertices[tree.find(p)[1]]
                bindings.append(
                    [
                        (src.vertex_groups[g.group].name, g.weight)
                        for g in original.groups
                    ]
                )
                if i and j:
                    k = start + i * frames + j
                    faces.append((k - frames - 1, k - frames, k, k - 1))
                    slots.append(mat)

    def normalized(v):
        return np.asarray(v) / max(0.00001, np.linalg.norm(v))

    def sorted_loop(points, angles):
        ordered = points[np.argsort(angles)]
        return np.vstack([ordered, ordered[0]])

    rings = boundaries(jacket)
    for side, sign in (("l", 1), ("r", -1)):
        wrist = rig.data.bones["lowerarm_" + side]
        axis = np.array((wrist.tail_local - wrist.head_local).normalized())
        center = np.array(wrist.tail_local)
        ring = min(
            (r for r in rings if sign * r[:, 0].mean() > 0.34 * s and len(r) >= 9),
            key=lambda r: np.linalg.norm(r.mean(0) - center),
        )
        pivot = ring.mean(0)
        u = normalized(np.cross(axis, [0, 0, 1]))
        v = np.cross(axis, u)
        loop = sorted_loop(ring, np.arctan2((ring - pivot) @ v, (ring - pivot) @ u))

        def outward(q):
            return normalized(q - pivot - axis * np.dot(q - pivot, axis))

        band(jacket, loop, lambda q: -axis, outward, 0, 0.024, 52)
    # The hem is open at the zip, so the rib stops at each placket.
    rim = min(rings, key=lambda r: r[:, 2].min())
    bottom = rim[rim[:, 2] < rim[:, 2].min() + 0.018 * s]
    bottom = bottom[
        np.argsort(np.mod(np.arctan2(bottom[:, 0], -bottom[:, 1]), 2 * np.pi))
    ]
    band(
        jacket,
        bottom,
        lambda q: np.array([0.0, 0.0, 1.0]),
        lambda q: normalized([q[0], q[1], 0]),
        0,
        0.024,
        115,
    )
    if shirt:
        neckline = max(boundaries(shirt), key=lambda r: r[:, 2].mean())
        center = neckline.mean(0)
        loop = sorted_loop(
            neckline, np.arctan2(neckline[:, 0] - center[0], neckline[:, 1] - center[1])
        )

        def out(q):
            return normalized([q[0] - center[0], q[1] - center[1], 0.011 * s])

        band(
            shirt,
            loop,
            lambda q: normalized(0.38 * out(q) - [0, 0, 1]),
            out,
            1,
            0.009,
            84,
        )
    obj = cloth_mesh(
        "Elastic cuffs, hem and crew-neck rib", points, faces, [shell, trim], slots
    )
    for i, weights in enumerate(bindings):
        for name, value in weights:
            group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
            group.add([i], value, "REPLACE")
    obj.parent = rig
    arm = obj.modifiers.new("Follow the garment bones", "ARMATURE")
    arm.object = rig
