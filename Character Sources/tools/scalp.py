"""Build a fitted scalp cap and comb individual fibres from a side part into a loose bun."""

import math, random
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def scalp(rig, ez, folder, lines, palette):
    from hero_finishes import anchored, finish_material

    scene = bpy.context.scene
    deps = bpy.context.evaluated_depsgraph_get()
    body = scene.objects["Body"]
    tree = BVHTree.FromObject(body, deps)
    center = Vector((0, -0.036, ez - 0.015))
    rng = random.Random(folder.name + " scalp")

    def horizon(a):
        return (
            1.19
            + 0.92 * (1 - math.cos(a)) * 0.5
            - 0.30 * abs(math.sin(a)) ** 7
            + 0.07 * math.sin(3 * a)
            + 0.025 * math.sin(11 * a)
        )

    A = 96
    B = 34
    grid = np.zeros((A, B + 1, 3))
    for i in range(A):
        a = math.tau * i / A
        for j in range(B + 1):
            t = horizon(a) * j / B
            vec = Vector(
                (
                    0.091 * math.sin(t) * math.sin(a),
                    -0.113 * math.sin(t) * math.cos(a),
                    0.137 * math.cos(t),
                )
            )
            n = vec.normalized()
            hit = tree.ray_cast(center + n * 0.32, -n)[0]
            if hit is None or (hit - center).length > 0.17:
                hit = center + vec
            if t > 1.1 and abs(math.sin(a)) > 0.81:
                hit = hit * 0.59 + (center + vec) * 0.41
            else:
                hit = center + n * max((hit - center).dot(n), vec.length)
            depth = (
                0.002
                + 0.011 * (1 - j / B) ** 0.65
                + 0.003 * math.sin(a * 2 + t) ** 2 * (1 - j / B)
            )
            grid[i, j] = (hit + n * depth)[:]

    def surface(a, t):
        ix = (a % math.tau) / math.tau * A
        iy = min(1, max(0, t / horizon(a))) * B
        i = int(ix) % A
        j = min(int(iy), B - 1)
        u = ix - int(ix)
        v = iy - j
        return (
            grid[i, j] * (1 - u) * (1 - v)
            + grid[(i + 1) % A, j] * u * (1 - v)
            + grid[i, j + 1] * (1 - u) * v
            + grid[(i + 1) % A, j + 1] * u * v
        )

    faces = []
    for i in range(A):
        for j in range(B - 4 - int(1.6 * math.sin(i * 1.9))):
            a = i * (B + 1) + j
            b = ((i + 1) % A) * (B + 1) + j
            faces.append((a, a + 1, b + 1, b))
    mesh = bpy.data.meshes.new("Fitted scalp cap")
    mesh.from_pydata(grid.reshape(-1, 3).tolist(), [], faces)
    mesh.update()
    cap = bpy.data.objects.new("Fitted scalp cap", mesh)
    scene.collection.objects.link(cap)
    mass = finish_material("Root shadow", (0.050, 0.031, 0.022), 0.87)
    mesh.materials.append(mass)
    for p in mesh.polygons:
        p.use_smooth = True
    anchored(cap, rig, "head")
    for _ in range(6700):
        a = rng.uniform(-math.pi, math.pi)
        side = 1 if a > -0.48 else -1
        t = rng.uniform(0.05, horizon(a) * 0.97)
        sweep = rng.uniform(0.26, 0.85)
        fall = rng.uniform(0.07, 0.37)
        height = rng.uniform(0.00022, 0.00125)
        points = []
        for k in range(7):
            f = k / 6
            ang = a + side * sweep * f
            lat = min(horizon(ang) - 0.007, t + fall * f)
            p = surface(ang, lat)
            norm = Vector(p) - center
            points.append(
                tuple(
                    Vector(p)
                    + norm.normalized() * (height + 0.00038 * math.sin(f * math.pi))
                )
            )
        lines.append((points, rng.choices(range(5), [24, 32, 26, 15, 3])[0], 0.78))
    return surface
