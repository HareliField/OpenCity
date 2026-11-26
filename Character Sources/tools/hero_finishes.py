"""Apply the pilot's approved garment cut, grooming and small personal details."""

import json, math, random
import bpy
import numpy as np
from mathutils import Vector
from blender_master import bake_identity
from portrait_surface import coordinates, smoothstep


def anchored(obj, rig, bone):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = world


def finish_material(name, colour, roughness=0.55, metal=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*colour, 1)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metal
    return m


def curves(name, lines, materials, depth, rig, bone):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 3
    data.bevel_depth = depth
    data.bevel_resolution = 1
    for mat in materials:
        data.materials.append(mat)
    for points, material, tip in lines:
        s = data.splines.new("BEZIER")
        s.material_index = material
        s.bezier_points.add(len(points) - 1)
        for i, (pt, v) in enumerate(zip(s.bezier_points, points)):
            pt.co = v
            pt.handle_left_type = "AUTO"
            pt.handle_right_type = "AUTO"
            pt.radius = 1 - tip * (i / (len(points) - 1)) ** 2
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    anchored(obj, rig, bone)
    return obj


def rear_colour(obj, folder):
    slot = obj.material_slots[0]
    mat = slot.material
    if mat.library:
        m = mat.copy()
        slot.link = "OBJECT"
        slot.material = m
        mat = m
    nt = mat.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    previous = bs.inputs["Base Color"].links[0].from_socket
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "Front garment"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(
        str(folder / "rear-colour.jpg"), check_existing=True
    )
    mask = nt.nodes.new("ShaderNodeTexImage")
    mask.image = bpy.data.images.load(
        str(folder / "rear-mask.png"), check_existing=True
    )
    mask.image.colorspace_settings.name = "Non-Color"
    for node in (tex, mask):
        nt.links.new(uv.outputs["UV"], node.inputs["Vector"])
    normal = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(normal.outputs["Normal"], sep.inputs[0])
    factor = nt.nodes.new("ShaderNodeMapRange")
    factor.inputs["From Min"].default_value = -0.05
    factor.inputs["From Max"].default_value = 0.56
    nt.links.new(sep.outputs["Y"], factor.inputs["Value"])
    multiply = nt.nodes.new("ShaderNodeMath")
    multiply.operation = "MULTIPLY"
    nt.links.new(factor.outputs[0], multiply.inputs[0])
    nt.links.new(mask.outputs[0], multiply.inputs[1])
    blend = nt.nodes.new("ShaderNodeMixRGB")
    nt.links.new(multiply.outputs[0], blend.inputs[0])
    nt.links.new(previous, blend.inputs[1])
    nt.links.new(tex.outputs[0], blend.inputs[2])
    nt.links.new(blend.outputs[0], bs.inputs["Base Color"])


def tailor(rig, folder):
    scene = bpy.context.scene
    obj = scene.objects.get("Cloth_jacket")
    if not obj:
        return
    obj.data = obj.data.copy()
    neutral = coordinates(obj)
    bake_identity(obj)
    pts = coordinates(obj)
    x, y, z = pts.T.copy()
    nx, ny, nz = neutral.T
    body = scene.objects["Body"]
    deps = bpy.context.evaluated_depsgraph_get()
    height = max(v[2] for v in body.evaluated_get(deps).bound_box)
    scale = height / 1.65
    # Blend out the rigid pocket flaps on the field jacket and gather the new waist.
    front = (abs(nx) < 0.212) & (nz < 1.28) & (nz > 0.8) & (ny < -0.054)
    if front.sum() > 12:
        X = np.column_stack([np.ones(len(nx)), nx**2, nz, nz * nz, nz**3, nx * nx * nz])
        coef = np.linalg.lstsq(X[front], y[front], rcond=None)[0]
        surface = X @ coef
        weight = (
            front * smoothstep(0.215, 0.17, np.abs(nx)) * smoothstep(1.29, 1.23, nz)
        )
        pts[:, 1] += np.clip((surface - y) * weight, -0.012, 0.024)
    hem = smoothstep(0.89, 0.805, nz) * smoothstep(0.25, 0.19, np.abs(nx))
    pts[:, 0] *= 1 - hem * 0.075
    pts[:, 1] += (np.sin(nx * 193) + np.cos(nx * 149 + nz * 34)) * 0.0018 * hem
    # Knit cuffs contract towards each wrist, leaving irregular folds above the band.
    wrist = smoothstep(0.454, 0.50, np.abs(nx))
    for sign in [-1, 1]:
        band = sign * nx > 0.45
        if band.any():
            center = np.mean(pts[band], axis=0)
            pts[band, 1:] += (center[1:] - pts[band, 1:]) * (0.17 * wrist[band, None])
    normals = np.asarray([v.normal[:] for v in obj.data.vertices])
    elbow = np.exp(-(((abs(nx) - 0.37) / 0.073) ** 2))
    waist = np.exp(-(((nz - 0.87) / 0.07) ** 2)) * (abs(nx) < 0.215)
    ripple = elbow * np.cos(abs(nx) * 137 + ny * 45 + nz * 21) * 0.0038
    ripple += waist * np.sin(nx * 148 + 12 * nz) * 0.0028
    pts += normals * ripple[:, None]
    obj.data.vertices.foreach_set("co", pts.astype(np.float32).ravel())
    obj.data.update()
    for poly in obj.data.polygons:
        poly.use_smooth = True
    mat = obj.material_slots[0].material
    nt = mat.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 580
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = 0.00021
    bump.inputs["Strength"].default_value = 0.16
    nt.links.new(noise.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], bs.inputs["Normal"])
    bs.inputs["Roughness"].default_value = 0.65
    if (folder / "rear-colour.jpg").exists():
        for garment in ("Cloth_jacket", "Cloth_jeans"):
            rear_colour(scene.objects[garment], folder)
    # The crew-neck rib sits close to the neck at every angle.
    from build_cast import linear_colour
    from mathutils.bvhtree import BVHTree

    scene["tint_Cloth_tshirt"] = linear_colour("#737174")
    shirt = scene.objects.get("Cloth_tshirt")
    if shirt:
        shirt.data = shirt.data.copy()
        original = coordinates(shirt)
        bake_identity(shirt)
        points = coordinates(shirt)
        body_tree = BVHTree.FromObject(body, deps)
        neck = rig.pose.bones["neck_01"].head.copy()
        for i, q in enumerate(points):
            if original[i, 2] < 1.31 or abs(original[i, 0]) > 0.109:
                continue
            delta = Vector((q[0] - neck.x, q[1] - neck.y, 0))
            if delta.length < 0.002:
                continue
            d = delta.normalized()
            origin = Vector((neck.x, neck.y, q[2]))
            hit = body_tree.ray_cast(origin + 0.34 * d, -d)[0]
            if hit is None:
                continue
            desired = (hit - origin).length + 0.003
            if desired < delta.length:
                blend = min(1, max(0, (original[i, 2] - 1.31) / 0.063))
                q2 = origin + d * (delta.length * (1 - blend) + desired * blend)
                points[i, :2] = q2[:2]
        shirt.data.vertices.foreach_set("co", points.astype(np.float32).ravel())
        shirt.data.update()
    hood_mat = finish_material("Washed red hood", (0.215, 0.055, 0.052), 0.72)
    vertices = []
    polys = []
    N = 42
    M = 9
    top = 1.41 * scale
    for i in range(N + 1):
        a = (i / N - 0.5) * math.pi
        c = math.cos(a)
        s = math.sin(a)
        for j in range(M + 1):
            t = j / M
            vertices.append(
                (
                    s * (0.080 + 0.082 * t) * scale,
                    (
                        0.010
                        + c * (0.070 + 0.063 * t)
                        + 0.012 * math.sin(2 * math.pi * t) * c
                    )
                    * scale,
                    top
                    + (
                        0.012
                        - 0.135 * t * c
                        + 0.019 * math.sin(2 * math.pi * t + 0.45 * s) * c
                    )
                    * scale,
                )
            )
            if i and j:
                a0 = i * (M + 1) + j
                polys.append((a0 - M - 2, a0 - M - 1, a0, a0 - 1))
    mesh = bpy.data.meshes.new("Folded hood pattern")
    mesh.from_pydata(vertices, [], polys)
    mesh.update()
    hood = bpy.data.objects.new("Folded windbreaker hood", mesh)
    scene.collection.objects.link(hood)
    mesh.materials.append(hood_mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    solid = hood.modifiers.new("Fold thickness", "SOLIDIFY")
    solid.thickness = 0.0015
    anchored(hood, rig, "spine_03")
    # A red loop tied through the bottom buttonhole is Ida's written recognition detail.
    pick = np.argmin(
        (pts[:, 0] - 0.044 * scale) ** 2
        + (pts[:, 2] - 0.864 * scale) ** 2
        + np.maximum(0, pts[:, 1] + 0.04) ** 2
    )
    px, py, pz = pts[pick]
    thread = finish_material("Red cotton thread", (0.38, 0.025, 0.022))
    line = [
        (px + 0.003, py - 0.004, pz + 0.003),
        (px - 0.003, py - 0.005, pz),
        (px + 0.003, py - 0.007, pz - 0.009),
        (px + 0.005, py - 0.004, pz - 0.002),
    ]
    curves(
        "Thread through the bottom buttonhole",
        [(line, 0, 0.38)],
        [thread],
        0.00072,
        rig,
        "pelvis",
    )
    obj["cut"] = "Gathered windbreaker waist and cuffs with folded hood"


def bun_and_fringe(rig, folder):
    from mathutils.bvhtree import BVHTree

    scene = bpy.context.scene
    deps = bpy.context.evaluated_depsgraph_get()
    obj = next(
        o for o in scene.objects if o.name.startswith("Hair_") and o.type == "MESH"
    )
    obj.data = obj.data.copy()
    bake_identity(obj)
    eyes = coordinates(scene.objects["Eyes"].evaluated_get(deps))
    ez = (eyes[:, 2].max() + eyes[:, 2].min()) * 0.5
    center = np.array([0.012, 0.099, ez + 0.016])
    obj.hide_render = True
    obj.hide_set(True)
    rng = random.Random(folder.name)
    palette = [
        finish_material("Hair fibre " + str(i), c, 0.49)
        for i, c in enumerate(
            [
                (0.030, 0.018, 0.012),
                (0.055, 0.031, 0.019),
                (0.084, 0.054, 0.036),
                (0.137, 0.099, 0.078),
                (0.22, 0.185, 0.156),
            ]
        )
    ]
    for m in palette:
        bs = m.node_tree.nodes.get("Principled BSDF")
        bs.inputs["Roughness"].default_value = 0.68
        bs.inputs["Specular IOR Level"].default_value = 0.22
    lines = []
    from scalp import scalp

    scalp(rig, ez, folder, lines, palette)
    for _ in range(1250):
        start = rng.uniform(0, math.tau)
        latitude = rng.uniform(-1.32, 1.32)
        radius = rng.uniform(0.91, 1.04)
        points = []
        for j in range(11):
            t = j / 10
            a = start + t * rng.uniform(0.84, 1.04) * 2.15
            lat = latitude + 0.14 * math.sin(t * math.pi + start)
            points.append(
                (
                    center[0] + 0.043 * math.cos(a) * math.cos(lat) * radius,
                    center[1] + 0.037 * math.sin(a) * math.cos(lat) * radius,
                    center[2] + 0.043 * math.sin(lat) * radius,
                )
            )
        lines.append((points, rng.choices(range(5), [35, 32, 22, 9, 2])[0], 0.76))
    guide_path = folder / "groom-guide.npz"
    if guide_path.is_file():
        guide = np.load(guide_path)
        mask = guide["mask"]
        angle = guide["angle"]
        tone = guide["tone"]
        eye_px, eye_py = guide["eyes"]
        span_px = float(guide["span"])
        eye_span = (eyes[:, 0].max() - eyes[:, 0].min()) * 0.97
        scale = eye_span / span_px
        ys, xs = np.nonzero(mask)
        eligible = (
            (ys > eye_py - 0.88 * span_px)
            & (ys < eye_py + 0.12 * span_px)
            & (np.abs(xs - eye_px) < span_px * 0.80)
        )
        seeds = np.flatnonzero(eligible)
        head_parts = [
            scene.objects[n]
            for n in ("Body", "Fitted scalp cap", "Measured face")
            if scene.objects.get(n)
        ]
        surfaces = [
            (
                BVHTree.FromObject(o, deps),
                o.matrix_world.copy(),
                o.matrix_world.inverted(),
            )
            for o in head_parts
        ]
        for strand in range(4200):
            idx = rng.choice(seeds)
            u = float(xs[idx]) + rng.uniform(-0.45, 0.45)
            v = float(ys[idx]) + rng.uniform(-0.45, 0.45)
            points = []
            prev = None
            step = rng.uniform(1.5, 3.0)
            shade = float(tone[round(v), round(u)])
            colour = min(4, max(0, int((shade - 0.14) * 8 + rng.uniform(-0.6, 0.6))))
            bulge = rng.uniform(0.0008, 0.0026)
            for j in range(rng.randint(6, 12)):
                ix, iy = round(u), round(v)
                if not (
                    0 <= ix < mask.shape[1] and 0 <= iy < mask.shape[0] and mask[iy, ix]
                ):
                    break
                x = (u - eye_px) * scale
                z = ez - (v - eye_py) * scale
                start = Vector((x, -1, z))
                hits = []
                for tr, world, inverse in surfaces:
                    p = tr.ray_cast(
                        inverse @ start, inverse.to_3x3() @ Vector((0, 1, 0))
                    )[0]
                    if p is not None:
                        hits.append((world @ p).y)
                if not hits:
                    break
                points.append((x, min(hits) - bulge, z))
                th = float(angle[iy, ix])
                du, dv = math.cos(th), math.sin(th)
                if (prev and du * prev[0] + dv * prev[1] < 0) or (not prev and dv < 0):
                    du, dv = -du, -dv
                if prev:
                    du = 0.64 * du + 0.36 * prev[0]
                    dv = 0.64 * dv + 0.36 * prev[1]
                prev = (du, dv)
                u += step * du
                v += step * dv
            if len(points) > 3:
                lines.append((points, colour, 0.91))
    curves(
        "Combed scalp, coiled bun and swept fringe",
        lines,
        palette,
        0.00024,
        rig,
        "head",
    )
    loose = []
    for side in (-1, 1):
        for strand in range(22):
            offset = rng.uniform(-0.003, 0.003)
            base_x = side * (0.075 + offset)
            base_y = -0.087 + rng.uniform(-0.008, 0.008)
            top = ez + 0.035 + offset
            length = rng.uniform(0.059, 0.10)
            points = []
            for k in range(7):
                t = k / 6
                points.append(
                    (
                        base_x
                        + side * (0.005 * math.sin(1.7 * math.pi * t) + 0.002 * t),
                        base_y
                        + 0.020 * t
                        + 0.006 * math.sin(t * math.tau + strand * 0.17),
                        top - length * t,
                    )
                )
            loose.append((points, strand % 4, 0.95))
    wisps = curves("Loose temple wisps", loose, palette, 0.00017, rig, "head")
    wisps.shape_key_add(name="Rest groom")
    sway = wisps.shape_key_add(name="Delayed tips")
    sway.slider_min = -1
    for i, pt in enumerate(sway.data):
        t = (i % 7) / 6
        offset = Vector((0.0017 * t * t, 0.0041 * t * t, -0.0006 * t * t))
        pt.co += offset
        if hasattr(pt, "handle_left"):
            pt.handle_left += offset
            pt.handle_right += offset
    silver = finish_material("Worn silver", (0.65, 0.68, 0.69), 0.25, 0.92)
    for side in [-1, 1]:
        cx = side * 0.079
        cy = -0.041
        cz = ez - 0.037
        loop = [
            (
                cx + 0.002 * math.cos(a),
                cy + 0.005 * math.cos(a),
                cz + 0.007 * math.sin(a),
            )
            for a in np.linspace(0, math.tau, 14)
        ]
        curves("Silver hoop earring", [(loop, 0, 0)], [silver], 0.00072, rig, "head")


def apply(rig, folder):
    source = folder / "art-direction.json"
    if not source.exists():
        return
    direction = json.loads(source.read_text())
    if direction.get("outerwear") == "red gathered windbreaker with a folded hood":
        tailor(rig, folder)
    if direction.get("hair") == "loose bun with side-swept fringe":
        bun_and_fringe(rig, folder)
