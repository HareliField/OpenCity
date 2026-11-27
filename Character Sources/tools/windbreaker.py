"""Recut the field-jacket front into welt pockets, a zip opening and a snap storm flap."""

import math
import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree


def remove_patch_pockets(jacket):
    bm = bmesh.new()
    bm.from_mesh(jacket.data)
    unseen = set(bm.verts)
    discard = []
    width = max(abs(v.co.x) for v in bm.verts)
    low, high = min(v.co.z for v in bm.verts), max(v.co.z for v in bm.verts)
    lapels = 0
    while unseen:
        seed = min(unseen, key=lambda v: v.index)
        unseen.remove(seed)
        piece = [seed]
        todo = [seed]
        while todo:
            v = todo.pop()
            for e in v.link_edges:
                w = e.other_vert(v)
                if w in unseen:
                    unseen.remove(w)
                    piece.append(w)
                    todo.append(w)
        if len(piece) < 80 and max(v.co.y for v in piece) < 0:
            discard.extend(piece)
        elif (
            len(piece) >= 80
            and max(abs(v.co.x) for v in piece) < 0.34 * width
            and min(v.co.z for v in piece) > low + 0.48 * (high - low)
        ):
            # The field-jacket pattern has two separate notched collar panels.
            discard.extend(piece)
            lapels += 1
    if lapels != 2:
        raise ValueError(f"Expected two field-jacket lapels, obtained {lapels}")
    bmesh.ops.delete(bm, geom=discard, context="VERTS")
    # The source panels terminate at each sewn-in pocket. Close those four
    # openings and continue their existing UVs across the shell fabric.
    edges = {e for e in bm.edges if e.is_boundary}
    closed = 0
    while edges:
        e = min(edges, key=lambda edge: edge.index)
        edges.remove(e)
        ring = {e}
        todo = [e]
        while todo:
            e = todo.pop()
            for v in e.verts:
                adjacent = set(v.link_edges) & edges
                edges.difference_update(adjacent)
                ring.update(adjacent)
                todo.extend(adjacent)
        verts = {v for e in ring for v in e.verts}
        if len(ring) != 14 or max(v.co.y for v in verts) > -0.045:
            continue
        layers = list(bm.loops.layers.uv.values())
        border_uv = {
            v: [v.link_loops[0][layer].uv.copy() for layer in layers] for v in verts
        }
        filled = bmesh.ops.holes_fill(
            bm, edges=sorted(ring, key=lambda edge: edge.index)
        )["faces"]
        for f in filled:
            f.smooth = True
            for l in f.loops:
                for layer, uv in zip(layers, border_uv[l.vert]):
                    l[layer].uv = uv
        bmesh.ops.triangulate(bm, faces=filled)
        closed += len(filled)
    if closed != 4:
        raise ValueError(f"Expected four closed windbreaker panels, obtained {closed}")
    bm.normal_update()
    bm.to_mesh(jacket.data)
    bm.free()
    jacket.data.update()


def add_trim(jacket, rig):
    from hero_finishes import finish_material

    scene = bpy.context.scene
    deps = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(jacket, deps)
    nearest = KDTree(len(jacket.data.vertices))
    for v in jacket.data.vertices:
        nearest.insert(v.co, v.index)
    nearest.balance()
    xyz = []
    faces = []
    slots = []
    weights = []

    def surface(x, z):
        loc = tree.ray_cast(Vector((x, -0.6, z)), Vector((0, 1, 0)))[0]
        return loc

    def vertex(p):
        xyz.append(tuple(p))
        src = jacket.data.vertices[nearest.find(p)[1]]
        weights.append(
            [(jacket.vertex_groups[g.group].name, g.weight) for g in src.groups]
        )
        return len(xyz) - 1

    def face(ids, mat):
        faces.append(ids)
        slots.append(mat)

    def strip(points, width, mat):
        last = None
        for k, p in enumerate(points):
            q = points[min(len(points) - 1, k + 1)] - points[max(0, k - 1)]
            cross = Vector((q.z, 0, -q.x)).normalized() * width * 0.5
            ids = [vertex(p - cross), vertex(p + cross)]
            if last:
                face((last[0], ids[0], ids[1], last[1]), mat)
            last = ids

    def button(p, r):
        c = vertex(p + Vector((0, -0.0012, 0)))
        ids = [
            vertex(
                p
                + Vector(
                    (
                        r * math.sin(i * math.tau / 12),
                        0,
                        r * math.cos(i * math.tau / 12),
                    )
                )
            )
            for i in range(12)
        ]
        for i in range(12):
            face((c, ids[(i + 1) % 12], ids[i]), 2)

    zlow = min(v.co.z for v in jacket.data.vertices) + 0.014
    for side in (-1, 1):
        line = []
        for z in np.linspace(zlow, 1.50, 68):
            for distance in np.linspace(0.01, 0.133, 62):
                p = surface(side * distance, z)
                if p is not None and p.y < -0.06:
                    p.x += side * 0.0018
                    p.y -= 0.002
                    line.append(p)
                    break
        if len(line) < 36:
            continue
        strip(line, 0.005, 0)
        for p in line[2:-4:2]:
            strip(
                [
                    p + Vector((-0.0028, -0.001, 0.0008)),
                    p + Vector((0.0028, -0.001, 0.0008)),
                ],
                0.0014,
                2,
            )
        for p in line[5:-4:13]:
            q = surface(p.x + side * 0.018, p.z)
            if q is not None:
                q.y -= 0.003
                button(q, 0.0043)
        # A grommet and a knotted drawcord hang from either side of the soft collar.
        eyelet = surface(side * 0.135, 1.535)
        if eyelet is not None:
            eyelet.y -= 0.0026
            circ = [
                eyelet + Vector((0.005 * math.sin(a), -0.0006, 0.0065 * math.cos(a)))
                for a in np.linspace(0, math.tau, 21)
            ]
            strip(circ, 0.0017, 2)
            cord = []
            for i in range(19):
                t = i / 18
                x = eyelet.x + side * (0.012 * t + 0.0032 * math.sin(4 * t))
                z = eyelet.z - 0.069 * t
                hit = surface(x, z)
                if hit:
                    hit.y -= 0.004 + 0.005 * math.sin(math.pi * t)
                    cord.append(hit)
            if len(cord) > 2:
                strip(cord, 0.0045, 0)
                strip(cord[-3:], 0.0048, 2)
        # The shoulder panels are sewn to the hood along a curved raglan seam.
        seam = []
        size = rig.data.bones["neck_01"].head_local.z / 1.622
        for t in np.linspace(0, 1, 34):
            x = (0.136 + 0.068 * t + 0.005 * np.sin(t * math.pi)) * size
            z = (1.596 - 0.142 * t - 0.012 * t * t) * size
            q = surface(side * x, z)
            if q is not None and q.y < 0:
                q.y -= 0.0019 * size
                seam.append(q)
        if len(seam) > 4:
            strip(seam, 0.0028 * size, 3)
            for k in range(1, len(seam) - 1, 2):
                p, q = seam[k], seam[k + 1]
                offset = Vector((side * 0.002 * size, -0.0003 * size, 0))
                strip([p + offset, (p.lerp(q, 0.60)) + offset], 0.00095 * size, 4)
        for a, b in [(1.01, 1.145)]:
            slit = []
            for t in np.linspace(0, 1, 24):
                p = surface(side * (0.099 + 0.074 * t), a + (b - a) * t)
                if p is not None:
                    p.y -= 0.0023
                    slit.append(p)
            if len(slit) > 2:
                strip(slit, 0.010, 1)
                lip = [p + Vector((side * 0.003, -0.0008, 0.002)) for p in slit]
                strip(lip, 0.0027, 0)
    mesh = bpy.data.meshes.new("Windbreaker trims")
    mesh.from_pydata(xyz, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Windbreaker zip, snaps and welt pockets", mesh)
    scene.collection.objects.link(obj)
    for name, c, rough, metal in [
        ("Oxblood zipper tape", (0.10, 0.022, 0.026), 0.64, 0),
        ("Pocket welt shadow", (0.028, 0.010, 0.012), 0.83, 0),
        ("Weathered gunmetal", (0.12, 0.108, 0.085), 0.34, 0.72),
        ("Raglan seam shadow", (0.145, 0.037, 0.043), 0.88, 0),
        ("Faded seam thread", (0.249, 0.080, 0.086), 0.89, 0),
    ]:
        mesh.materials.append(finish_material(name, c, rough, metal))
    for p, i in zip(mesh.polygons, slots):
        p.material_index = i
    mesh.uv_layers.new(name="UVMap")
    for i, groups in enumerate(weights):
        for name, weight in groups:
            group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
            group.add([i], weight, "REPLACE")
    obj.parent = rig
    mod = obj.modifiers.new("Garment armature", "ARMATURE")
    mod.object = rig
