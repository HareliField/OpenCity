"""Lay editable strands over each fitted hair mass and shape the fringe independently."""

import math
import random
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from build_cast import linear_colour


def groom(rig, person, colours):
    scene = bpy.context.scene
    hair = next((o for o in scene.objects if o.name.startswith("Hair_")), None)
    if not hair:
        return
    deps = bpy.context.evaluated_depsgraph_get()
    evaluated = hair.evaluated_get(deps)
    tree = BVHTree.FromObject(hair, deps)
    corners = [Vector(p) for p in evaluated.bound_box]
    xmin, xmax = min(p.x for p in corners), max(p.x for p in corners)
    zmin, zmax = min(p.z for p in corners), max(p.z for p in corners)
    width = xmax - xmin
    height = zmax - zmin
    if min(width, height) < 0.01:
        return
    rng = random.Random(person["residentId"] + " hair")
    curve = bpy.data.curves.new("Individual hair strands", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_resolution = 1
    curve.bevel_depth = 0.00031
    strand = bpy.data.objects.new("Individual hair strands", curve)
    scene.collection.objects.link(strand)
    colour = linear_colour(colours["Hair"])
    material = bpy.data.materials.new("Strand pigment")
    material.diffuse_color = colour
    material.use_nodes = True
    bs = material.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = colour
    bs.inputs["Roughness"].default_value = 0.4
    curve.materials.append(material)

    def add(points):
        spline = curve.splines.new("BEZIER")
        spline.bezier_points.add(len(points) - 1)
        for i, (p, co) in enumerate(zip(spline.bezier_points, points)):
            p.co = co
            p.handle_left_type = "AUTO"
            p.handle_right_type = "AUTO"
            p.radius = 0.92 - (i / (len(points) - 1)) ** 2 * 0.83

    part = rng.uniform(-0.18, 0.18) * width
    for _ in range(250):
        start = rng.uniform(xmin * 0.83, xmax * 0.83)
        top = zmax - rng.uniform(0.03, 0.55) * height
        sign = 1 if start > part else -1
        reach = rng.uniform(0.05, 0.18) * width
        length = rng.uniform(0.08, 0.30) * height
        points = []
        for i in range(6):
            t = i / 5
            x = start + sign * reach * (t**0.76)
            z = top - length * t
            loc, n, _, _ = tree.ray_cast((x, -1, z), (0, 1, 0))
            if loc is None or points and (loc - points[-1]).length > 0.028:
                break
            points.append(loc + n * (0.00075 + 0.0006 * math.sin(math.pi * t)))
        if len(points) > 2:
            add(points)
    if "fringe" in person["appearance"].lower():
        body = next(o for o in scene.objects if o.name == "Body")
        surface = BVHTree.FromObject(body, deps)
        eyes = next(o for o in scene.objects if o.name == "Eyes").evaluated_get(deps)
        brow = max(p[2] for p in eyes.bound_box) + 0.011
        for _ in range(190):
            x0 = rng.uniform(-0.23, 0.22) * width
            x1 = x0 + width * rng.uniform(0.06, 0.22)
            top = zmax - height * rng.uniform(0.12, 0.26)
            end = brow + rng.uniform(-0.008, 0.014)
            points = []
            for i in range(7):
                t = i / 6
                x = x0 + (x1 - x0) * t
                z = top * (1 - t) + end * t
                a, _, _, _ = tree.ray_cast((x, -1, z), (0, 1, 0))
                b, _, _, _ = surface.ray_cast((x, -1, z), (0, 1, 0))
                hits = [q for q in (a, b) if q is not None]
                if not hits:
                    break
                front = min(q.y for q in hits) - 0.001 - 0.002 * math.sin(math.pi * t)
                points.append(Vector((x, front, z)))
            if len(points) > 3:
                add(points)
    rest = strand.matrix_world.copy()
    strand.parent = rig
    strand.parent_type = "BONE"
    strand.parent_bone = "head"
    bpy.context.view_layer.update()
    strand.matrix_world = rest
