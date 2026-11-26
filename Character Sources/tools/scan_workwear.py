"""Fit the photographed garment surfaces to the anatomical resident's real joints."""

import bpy
import json
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def points_in_world(obj, points):
    matrix = np.asarray(obj.matrix_world)
    return points @ matrix[:3, :3].T + matrix[:3, 3]


def captured_weights(scan, source):
    names = {
        "Hips": "pelvis",
        "Spine02": "spine_01",
        "Spine01": "spine_02",
        "Spine": "spine_03",
        "neck": "neck_01",
        "Head": "head",
        "head_end": "head",
        "headfront": "head",
    }
    limb = {
        "Shoulder": "clavicle",
        "Arm": "upperarm",
        "ForeArm": "lowerarm",
        "Hand": "hand",
        "UpLeg": "thigh",
        "Leg": "calf",
        "Foot": "foot",
        "ToeBase": "ball",
    }
    for prefix, suffix in (("Left", "l"), ("Right", "r")):
        names.update(
            {prefix + key: value + "_" + suffix for key, value in limb.items()}
        )
    groups = {name: np.zeros(len(source), "f") for name in names.values()}
    for vert in scan.data.vertices:
        for g in vert.groups:
            name = scan.vertex_groups[g.group].name
            if name not in names:
                if g.weight > 0.00001:
                    raise ValueError(f"Unmapped captured joint {name}")
                continue
            groups[names[name]][vert.index] += g.weight
    total = sum(groups.values())
    if np.any(total < 0.99):
        raise ValueError("Captured wardrobe includes unweighted vertices")
    for values in groups.values():
        values /= total
    return groups


def separate_limbs(groups, source, tri, parts, joints):
    # The scan skinner can bind the hanging work coat to a nearby thigh or
    # mix the hem with the wrist. Reassign those weights using the position
    # of each photographed sleeve, before solving its inverse rest position.
    cloth = np.zeros(len(source), bool)
    cloth[tri[(parts == 0) | (parts == 1)].ravel()] = True
    for name in ("head", "neck_01"):
        groups["spine_03"][cloth] += groups[name][cloth]
        groups[name][cloth] = 0
    for prefix, suffix in (("Left", "l"), ("Right", "r")):
        lower = joints[prefix + "ForeArm"]
        wrist = joints[prefix + "Hand"]
        axis = lower - wrist
        frac = np.clip(((source - wrist) @ axis) / np.dot(axis, axis), -0.14, 1.15)
        distance = np.linalg.norm(source - (wrist + frac[:, None] * axis), axis=1)
        near = (
            cloth
            & (source[:, 2] < lower[2] + 0.045)
            & ((source[:, 0] > 0) == (suffix == "l"))
        )
        axial = np.clip((lower[2] + 0.07 - source[:, 2]) / 0.075, 0, 1)
        axial = axial * axial * (3 - 2 * axial) * near
        shell = np.clip((distance - 0.040) / 0.056, 0, 1)
        shell = shell * shell * (3 - 2 * shell)
        # The low hem and cuffs come within millimetres in the captured stance.
        # Preserve their exact assignments there and ease the upper elbow folds.
        pinned = near & (source[:, 2] < wrist[2] + 0.075)
        shell[pinned] = (distance[pinned] >= 0.064).astype(float)
        axial[pinned] = 1
        arm_names = tuple(
            tag + "_" + suffix for tag in ("lowerarm", "upperarm", "hand", "clavicle")
        )
        moves = {}
        for name, weight in groups.items():
            arm_member = name in arm_names
            amount = weight * (shell if arm_member else (1 - shell)) * axial
            moves[name] = amount
        for name, amount in moves.items():
            groups[name] -= amount
            groups["pelvis" if name in arm_names else "lowerarm_" + suffix] += amount
    for name, weight in groups.items():
        if name.startswith(("thigh_", "calf_", "foot_", "ball_")):
            groups["pelvis"][cloth] += weight[cloth]
            weight[cloth] = 0


def classify(mesh, verts, face_uv, joints):
    # Sample the original atlas at triangle centres to preserve the actual
    # irregular hems, cuffs, placket, sole, crew neck and front of the hood.
    principal = next(
        n for n in mesh.materials[0].node_tree.nodes if n.type == "BSDF_PRINCIPLED"
    )
    tex = principal.inputs["Base Color"].links[0].from_node.image
    sampler = tex.copy()
    sampler.scale(960, 960)
    w, h = sampler.size
    pixels = np.empty(w * h * 4, "f")
    sampler.pixels.foreach_get(pixels)
    layer = pixels.reshape(h, w, 4)
    uv = face_uv.mean(1) % 1
    color = layer[
        np.minimum(h - 1, (uv[:, 1] * h).astype(int)),
        np.minimum(w - 1, (uv[:, 0] * w).astype(int)),
        :3,
    ].copy()
    bpy.data.images.remove(sampler)
    signed = verts[:, :, 0].mean(1)
    x = abs(signed)
    y = verts[:, :, 1].mean(1)
    z = verts[:, :, 2].mean(1)
    red, green, blue = color.T
    jacket = (red > green * 1.27) & (red > blue * 1.19) & (red > 0.10)
    skin = (
        (green > red * 0.62) & (blue > red * 0.52) & (red > green * 1.06) & (red > 0.23)
    )
    parts = np.where(z < 0.115, 3, np.where(z < 0.858, 2, np.where(jacket, 0, 1)))
    # Dark trim/shadow shades are still shell fabric outside the shirt opening.
    jacket_zone = (z > 0.81) & ((x > 0.095) | (y > 0.015))
    parts[jacket_zone] = 0
    parts[(z > 0.78) & (z < 0.94) & jacket] = 0
    # The lower part of both arms crosses the side of the trousers in the scan.
    arm = x > 0.206
    parts[arm & (z > 0.788)] = 0
    wrist_z = np.where(signed > 0, joints["LeftHand"][2], joints["RightHand"][2])
    hand = (
        arm
        & (z < wrist_z + 0.068)
        & (skin | (~jacket & (z < wrist_z + 0.01)) | (z < wrist_z - 0.018))
    )
    parts[hand] = -1
    center = abs(signed - joints["neck"][0])
    collar = (center < 0.109) & (z > joints["neck"][2] - 0.050)
    parts[collar & skin & ~jacket] = 4
    # The under-chin shadow is brown in the atlas and would otherwise be
    # misclassified as fragments of the red shell or gray T-shirt.
    true_red = (red > green * 1.72) & (red > blue * 1.52)
    parts[(center < 0.105) & (z > joints["neck"][2] - 0.011) & ~true_red] = 4
    parts[(center < 0.073) & (z > joints["neck"][2] - 0.002)] = 4
    # The complete captured throat, lower jaw and skin behind the ears form
    # one continuous surface. Cut above the mouth and cheeks, under the native
    # face plate. Leave the red hood outside that facial neighbourhood.
    parts[(z > joints["neck"][2] + 0.020) & (center < 0.12)] = 4
    parts[(z > joints["neck"][2] + 0.073)] = 4
    # Retain Ida's entire opaque captured head beneath the editable facial
    # plate. Remove the detached outer wisps, which belong to the separate groom.
    return parts


def match_groom_lining(folder, uv, parts):
    archive = folder / "captured-hair.npz"
    if not archive.is_file():
        return
    with np.load(archive) as data:
        if "sourceHairUV" not in data:
            return
        original = data["sourceHairUV"].astype("d")
    # The glTF importer switches the texture origin to Blender's bottom left.
    # Compare the original UV-centres, independent of seam-vertex duplication.
    original[:, 1] = 1 - original[:, 1]
    grid = 1000000
    original = np.rint(original * grid).astype(np.int64)
    imported = np.rint(uv.mean(1) * grid).astype(np.int64)
    keys = original[:, 0] * (2 * grid) + original[:, 1]
    candidates = imported[:, 0] * (2 * grid) + imported[:, 1]
    hair = np.zeros(len(parts), bool)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            hair |= np.isin(candidates + dx * (2 * grid) + dy, keys)
    count = np.count_nonzero(hair & (parts == 4))
    if count < 0.70 * len(original):
        raise ValueError(
            f"Captured groom UVs do not match the wardrobe scan ({count}/{len(original)})"
        )
    parts[hair & (parts == 4)] = 5
    print("Matched", count, "donor hair triangles beneath the independent groom")


def photo_rest(rig, folder, source, src_joints, groups, tri, parts):
    from resident_motion import activate, captured, portion, write_action
    from workday_performance import fit_performance

    scene = bpy.context.scene
    old_frame = scene.frame_current
    prior_location = rig.location.copy()
    prior_basis = {b.name: b.matrix_basis.copy() for b in rig.pose.bones}
    action = rig.animation_data.action if rig.animation_data else None
    take = portion(captured(rig, "idle_shift"), 12, 78)
    take["location"][:, :2] = 0
    fit_performance(rig, take, "counter_rest", folder)
    fitted = write_action(rig, "Photographic fitting pose", take)
    activate(rig, fitted)
    scene.frame_set(17)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    shoe = scene.objects["Cloth_shoes"].evaluated_get(deps)
    photo = json.loads((folder / "art-direction.json").read_text())["performance"][
        "castingView"
    ]
    crowns = (photo["crownMesh"], *photo.get("alternateCrownMeshes", ()))
    crown = next(
        scene.objects[name] for name in crowns if name in scene.objects
    ).evaluated_get(deps)
    high = max((crown.matrix_world @ v.co).z for v in crown.data.vertices)
    low = min((shoe.matrix_world @ v.co).z for v in shoe.data.vertices)
    size = (high - low) / np.ptp(source[:, 2])
    target_neck = np.array(rig.matrix_world @ rig.pose.bones["neck_01"].head)
    shift = np.array(
        [
            target_neck[0] - 0.005 * size,
            target_neck[1] - src_joints["neck"][1] * size,
            low - source[:, 2].min() * size,
        ]
    )
    desired = source * size + shift
    for pre, side in (("Left", "l"), ("Right", "r")):
        # Depth is unconstrained in a front photograph; bring each cuff onto the actual wrist.
        error = np.array(rig.matrix_world @ rig.pose.bones["hand_" + side].head) - (
            src_joints[pre + "Hand"] * size + shift
        )
        error[[0, 2]] = np.clip(error[[0, 2]], -0.025, 0.025)
        dist = np.linalg.norm(source - src_joints[pre + "Hand"], axis=1)
        falloff = np.exp(-((dist / 0.096) ** 2))
        desired += falloff[:, None] * error
    # Register the actual photographed jaw and mouth to the measured face.
    # The blend reaches full strength above the throat and preserves the
    # original neckline and shoulders at their measured height.
    scan_surface = BVHTree.FromPolygons(
        [Vector(x) for x in source], tri, all_triangles=True
    )
    marks = np.fromfile(folder / "face-sculpt.bin", dtype="<f4").reshape(-1, 3)
    face = scene.objects["Measured face"].evaluated_get(deps)
    ref = json.loads((folder / "photo-fit.json").read_text())
    width, height = ref["sourcePixels"]
    native_marks = np.array([face.matrix_world @ v.co for v in face.data.vertices])
    src_scale = np.ptp(source[:, 2]) / (photo["soleY"] - photo["crownY"])
    anchor_ids = (152, 172, 397, 234, 454, 13, 14, 61, 291, 33, 263, 168, 4, 10)
    ref_marks = []
    dest_marks = []
    for ix in anchor_ids:
        u, v, _ = marks[ix]
        x = (u - photo["centerX"]) * src_scale * width / height + src_joints["neck"][0]
        z = (photo["soleY"] - v) * src_scale + source[:, 2].min()
        hit = scan_surface.ray_cast(Vector((x, -0.4, z)), Vector((0, 1, 0)), 0.8)[0]
        if hit is None:
            continue
        ref_marks.append(np.asarray(hit))
        dest_marks.append(native_marks[ix])
    actual = np.asarray(ref_marks)
    target = np.asarray(dest_marks)
    if len(actual) < 5:
        raise ValueError("Too few lower-face correspondences for the captured wardrobe")
    # Source scan directions match the anatomical axes. A local scale and
    # offset per axis align the cheek span and jawline without tilting the neck.
    slope = np.array(
        [
            np.linalg.lstsq(
                np.column_stack((actual[:, axis], np.ones(len(actual)))),
                target[:, axis],
                rcond=None,
            )[0]
            for axis in (0, 2)
        ]
    )
    aligned = desired.copy()
    aligned[:, 0] = source[:, 0] * slope[0, 0] + slope[0, 1]
    aligned[:, 2] = source[:, 2] * slope[1, 0] + slope[1, 1]
    aligned[:, 1] += np.median(target[:, 1] - (actual[:, 1] * size + shift[1]))
    seam = np.clip((source[:, 2] - src_joints["neck"][2] + 0.003) / 0.086, 0, 1)
    seam = seam * seam * (3 - 2 * seam)
    desired += (aligned - desired) * seam[:, None]
    # On the frontal lower face, settle the scan just below the measured
    # facial surface. The original jaw remains visible around and beneath it.
    face_tree = BVHTree.FromObject(face, deps)
    face_inv = face.matrix_world.inverted()
    in_front = (
        (source[:, 2] > np.min(actual[:, 2]) - 0.010)
        & (source[:, 1] < src_joints["neck"][1] - 0.020)
        & (abs(source[:, 0] - src_joints["neck"][0]) < 0.118)
    )
    for ix in np.flatnonzero(in_front):
        v = desired[ix]
        start = face_inv @ Vector((v[0], -0.48, v[2]))
        end = face_inv @ Vector((v[0], 0.35, v[2]))
        hit = face_tree.ray_cast(
            start, (end - start).normalized(), (end - start).length
        )[0]
        if hit is not None:
            surface = face.matrix_world @ hit
            v[1] = max(v[1], surface.y + 0.0025)
    native = scene.objects["Body"]
    native.data = native.data.copy()
    bpy.context.view_layer.update()
    # The captured head and neck remain one opaque surface. Fit the top
    # and back of the cranium under the separately registered groom and fit
    # the actual eyes/lips just behind the unchanged photographic face.
    mid = np.mean(native_marks[[13, 14]], axis=0)
    chin = native_marks[152]
    core = np.asarray(rig.matrix_world @ rig.pose.bones["head"].head)
    # Preserve the donor's original skin/hair atlas through every triangle.
    # The face, temple, ear and fringe share an anatomical surface even when
    # the separate groom moves or the head is viewed from the side.
    hair_vertex = np.zeros(len(source), bool)
    hair_vertex[tri[parts == 5].ravel()] = True
    cranial = np.zeros(len(source), bool)
    cranial[tri[(parts == 4) | (parts == 5)].ravel()] = True
    # UV seams can duplicate a vertex. Use the same displacement and head
    # weighting for all copies, including the fringe-sheet attachment edge.
    _, weld = np.unique(
        np.rint(source * 100000).astype(np.int32), axis=0, return_inverse=True
    )
    any_hair = np.zeros(weld.max() + 1, bool)
    np.logical_or.at(any_hair, weld, hair_vertex)
    hair_vertex = any_hair[weld]
    line_weight = np.clip((desired[:, 2] - chin[2] + 0.024) / 0.043, 0, 1)
    line_weight = line_weight * line_weight * (3 - 2 * line_weight) * cranial
    line_weight[hair_vertex] = 1
    native_surface = BVHTree.FromObject(native, deps)
    inv = native.matrix_world.inverted()
    aligned_normals = np.zeros_like(source)
    for ix in np.flatnonzero(line_weight):
        v = desired[ix]
        # Ear locks extend below the jaw. Keep their original dark colour but
        # constrain the entire strand to the head/neck, including its free tip.
        c = core.copy()
        c[2] = v[2]
        radial = v - c
        length = np.linalg.norm(radial)
        if length < 0.001:
            continue
        radial /= length
        start = inv @ Vector(c + 0.30 * radial)
        end = inv @ Vector(c - 0.02 * radial)
        hit, normal, _, _ = native_surface.ray_cast(
            start, (end - start).normalized(), (end - start).length
        )
        if hit is None:
            hit, normal, _, _ = native_surface.find_nearest(inv @ Vector(v))
        if hit is None:
            continue
        surface = np.asarray(native.matrix_world @ hit)
        n = np.asarray(native.matrix_world.to_3x3().inverted().transposed() @ normal)
        n = n / max(0.001, np.linalg.norm(n))
        inset = 0.005 if hair_vertex[ix] else 0.0016
        # Dark donor hair sits inside the separately fitted roots, with no
        # hanging double volume. Ears and jaw outside the groom stay intact.
        v += (surface - inset * n - v) * line_weight[ix]
        aligned_normals[ix] = n * line_weight[ix]
    # A radial ray hitting the near rim of an ear instead of the temple can
    # move neighbours in opposite directions and stretch a hair triangle into
    # a spike. Register the original relief as one continuous surface there.
    def ramp(value):
        t = np.clip(value, 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    ear_height = source[:, 2] - actual[0, 2]
    forward = actual[0, 1] - source[:, 1]
    lateral = np.abs(source[:, 0] - src_joints["neck"][0])
    context = (cranial & (ear_height > 0.009) & (ear_height < 0.184)
               & (forward > -0.147) & (forward < 0.006) & (lateral < 0.104))
    side_relief = (ramp((lateral - 0.045) / 0.035)
                   * ramp((ear_height - 0.015) / 0.048)
                   * ramp((0.202 - ear_height) / 0.045)
                   * ramp((0.028 - forward) / 0.055)
                   * ramp((forward + 0.207) / 0.063) * cranial)
    if context.sum() >= 20 and np.any(side_relief):
        source_basis = np.column_stack((source, np.ones(len(source))))
        transform = np.linalg.lstsq(source_basis[context], desired[context], rcond=None)[0]
        desired += (source_basis @ transform - desired) * side_relief[:, None]
        aligned_normals *= (1.0 - side_relief[:, None])
    for ix in np.flatnonzero(in_front):
        v = desired[ix]
        start = face_inv @ Vector((v[0], -0.48, v[2]))
        end = face_inv @ Vector((v[0], 0.35, v[2]))
        hit = face_tree.ray_cast(
            start, (end - start).normalized(), (end - start).length
        )[0]
        if hit is not None:
            v[1] = max(v[1], (face.matrix_world @ hit).y + 0.0032)
    # Above the jaw both the fitted donor and measured face follow the head.
    # Preserve the donor's natural neck/spine transition down to the real collar.
    head_mix = np.clip((desired[:, 2] - chin[2] + 0.014) / 0.040, 0, 1)
    head_mix = head_mix * head_mix * (3 - 2 * head_mix) * cranial
    for name, w in groups.items():
        if name != "head":
            move = w * head_mix
            w -= move
            groups["head"] += move
    # Keep a recessed anatomical scalp only in the area under the translucent
    # roots and behind the ears. The entire visible jaw and throat are donated
    # by one continuous skin, with no cut anywhere across exposed skin.
    backup = native.evaluated_get(deps).data
    co = np.empty((len(backup.vertices), 3), "f")
    backup.vertices.foreach_get("co", co.ravel())
    body_world = points_in_world(native, co)
    # Match the liner to the interior of the actual donor, including the
    # skin around the temple where the groom leaves narrow gaps.
    donor = BVHTree.FromPolygons([Vector(v) for v in desired], tri, all_triangles=True)
    face_ids = np.flatnonzero(body_world[:, 2] > chin[2] - 0.025)
    recess = native.shape_key_add(
        name="Scalp carrier beneath the captured groom", from_mix=False
    )
    carrier_head = native.vertex_groups["head"]
    carrier_world = np.asarray(native.matrix_world)
    inverse_world = np.linalg.inv(carrier_world)
    for ix in face_ids:
        v = body_world[ix]
        c = core.copy()
        c[2] = v[2]
        radial = v - c
        length = np.linalg.norm(radial)
        if length < 0.001:
            continue
        radial /= length
        hit = donor.ray_cast(Vector(c + 0.270 * radial), Vector(-radial), 0.31)[0]
        inset = 0.0018 + 0.009 * np.clip((chin[2] + 0.001 - v[2]) / 0.025, 0, 1)
        radius = length - 0.002
        if hit is not None:
            radius = min(radius, np.dot(np.asarray(hit) - c, radial) - inset)
        d = (radius - length) * radial
        # Keep the editable native carrier inside the donated ear and skull.
        # A horizontal radial solve does not recess the top of the cranium.
        height_above_chin = v[2] - chin[2]
        side = (ramp((abs(v[0] - core[0]) - 0.050) / 0.030)
                * ramp((height_above_chin - 0.006) / 0.047)
                * ramp((0.223 - height_above_chin) / 0.041))
        d -= (0.019 * side) * radial
        d[2] -= 0.012 * ramp((height_above_chin - 0.148) / 0.047)
        # The donor is rigidly head-weighted above the jaw. In a deep nod
        # the old neck influence otherwise drives the backing scalp through it.
        # Preserve the fitted position when changing weights at this pose.
        head_amount = ramp((v[2] - chin[2] - 0.007) / 0.050)
        old_transform = np.zeros((4, 4))
        new_transform = np.zeros((4, 4))
        shift_to_head = 0.0
        for membership in list(native.data.vertices[ix].groups):
            group = native.vertex_groups[membership.group]
            bone = rig.pose.bones.get(group.name)
            if bone is None:
                continue
            matrix = np.asarray(bone.matrix @ bone.bone.matrix_local.inverted())
            original_weight = membership.weight
            transferred = original_weight * head_amount if group != carrier_head else 0.0
            old_transform += original_weight * matrix
            new_transform += (original_weight - transferred) * matrix
            if transferred > 0:
                group.add([int(ix)], original_weight - transferred, "REPLACE")
                shift_to_head += transferred
        if shift_to_head:
            carrier_head.add([int(ix)], shift_to_head, "ADD")
            head = rig.pose.bones[carrier_head.name]
            new_transform += shift_to_head * np.asarray(head.matrix @ head.bone.matrix_local.inverted())
        if min(abs(np.linalg.det(old_transform)), abs(np.linalg.det(new_transform))) > 1e-6:
            old_rest = np.linalg.solve(old_transform, inverse_world @ np.append(v, 1.0))
            new_rest = np.linalg.solve(new_transform, inverse_world @ np.append(v + d, 1.0))
            recess.data[ix].co += Vector(new_rest[:3] - old_rest[:3])
    recess.value = 1
    rig_world = np.asarray(rig.matrix_world)
    local = (desired - rig_world[:3, 3]) @ np.linalg.inv(rig_world[:3, :3]).T
    print(
        "Captured chin",
        actual[0].round(4),
        "native chin",
        target[0].round(4),
        "mouth height",
        round(mid[2], 4),
    )
    matrices = np.zeros((len(local), 3, 3))
    offsets = np.zeros_like(local)
    for name, w in groups.items():
        b = rig.pose.bones[name]
        transform = np.array(b.matrix @ b.bone.matrix_local.inverted())
        matrices += w[:, None, None] * transform[:3, :3]
        offsets += w[:, None] * transform[:3, 3]
    result = np.linalg.solve(matrices, (local - offsets)[:, :, None])[:, :, 0]
    if not np.isfinite(result).all():
        raise ValueError("Invalid photographed garment rest fit")
    rig.animation_data.action = action
    bpy.data.actions.remove(fitted)
    scene.frame_set(old_frame)
    rig.location = prior_location
    for b in rig.pose.bones:
        b.matrix_basis = prior_basis[b.name]
    bpy.context.view_layer.update()
    return result, rig_world[:3, :3] @ matrices, face_ids, aligned_normals


def exposed_anatomy(rig, face_ids):
    body = bpy.context.scene.objects["Body"]
    fit = body.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    coords = np.empty(len(fit.vertices) * 3, "f")
    fit.vertices.foreach_get("co", coords)
    p = coords.reshape(-1, 3)
    neck = np.asarray(rig.data.bones["neck_01"].head_local)
    size = neck[2] / 1.622
    keep = np.zeros(len(p), bool)
    keep[face_ids] = True
    is_hand = np.array(
        [
            any(
                body.vertex_groups[g.group].name.startswith(
                    ("hand_", "thumb_", "index_", "middle_", "ring_", "pinky_")
                )
                and g.weight > 0.40
                for g in v.groups
            )
            for v in body.data.vertices
        ]
    )
    for suffix in ("l", "r"):
        b = rig.data.bones["lowerarm_" + suffix]
        wrist = np.array(b.tail_local)
        axis = np.array((b.tail_local - b.head_local).normalized())
        delta = p - wrist
        dist = delta @ axis
        # Fingers and palms can project beyond the wrist plane in any direction.
        keep |= is_hand | (
            (dist > -0.052 * size) & (np.linalg.norm(delta, axis=1) < 0.17 * size)
        )
    visible = body.vertex_groups.new(name="Skin exposed by Ida's photographed wardrobe")
    visible.add(np.flatnonzero(keep).tolist(), 1, "REPLACE")
    mask = body.modifiers.new("Keep exposed neck, wrists, hands and face", "MASK")
    mask.vertex_group = visible.name


def transfer(rig, folder, source_name, albedo_name=None):
    if (
        not isinstance(source_name, str)
        or Path(source_name).name != source_name
        or not source_name.lower().endswith(".glb")
    ):
        raise ValueError("wardrobeScan must be a local rigged GLB filename")
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(
        filepath=str(folder / source_name), import_pack_images=True
    )
    added = [o for o in bpy.data.objects if o not in existing]
    scan = next(o for o in added if o.type == "MESH")
    src = next(o for o in added if o.type == "ARMATURE")
    mesh = scan.data
    mesh.calc_loop_triangles()
    co = np.empty(len(mesh.vertices) * 3, "f")
    mesh.vertices.foreach_get("co", co)
    source = points_in_world(scan, co.reshape(-1, 3))
    tri = np.empty(len(mesh.loop_triangles) * 3, np.int32)
    mesh.loop_triangles.foreach_get("vertices", tri)
    tri = tri.reshape(-1, 3)
    loops = np.empty(len(mesh.loop_triangles) * 3, np.int32)
    mesh.loop_triangles.foreach_get("loops", loops)
    uv = np.empty(len(mesh.loops) * 2, "f")
    mesh.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)[loops.reshape(-1, 3)]
    joints = {b.name: np.array(src.matrix_world @ b.head_local) for b in src.data.bones}
    groups = captured_weights(scan, source)
    parts = classify(mesh, source[tri], uv, joints)
    match_groom_lining(folder, uv, parts)
    separate_limbs(groups, source, tri, parts, joints)
    dest, rest_normals, face_ids, aligned_normals = photo_rest(
        rig, folder, source, joints, groups, tri, parts
    )
    normals = np.empty((len(mesh.loops), 3), "f")
    mesh.corner_normals.foreach_get("vector", normals.ravel())
    normals = normals[loops.reshape(-1, 3)] @ np.linalg.inv(
        np.asarray(scan.matrix_world)[:3, :3]
    )
    normals /= np.maximum(1.0e-8, np.linalg.norm(normals, axis=2, keepdims=True))
    confidence = np.linalg.norm(aligned_normals[tri], axis=2, keepdims=True)
    normals = (1 - confidence) * normals + aligned_normals[tri]
    normals = np.einsum("...ij,...i->...j", rest_normals[tri], normals)
    parts[parts == 5] = 4
    normals /= np.maximum(1.0e-8, np.linalg.norm(normals, axis=2, keepdims=True))
    for o in list(bpy.context.scene.objects):
        if o in added:
            continue
        if o.name.startswith(
            (
                "Cloth_",
                "Folded windbreaker hood",
                "Windbreaker zip",
                "Elastic cuffs",
                "Work trainer",
                "Thread through the bottom",
            )
        ):
            o.name = "Editable pattern | " + o.name
            o.hide_render = True
            o.hide_set(True)
    mat = mesh.materials[0]
    fabric = mat
    if albedo_name:
        if Path(albedo_name).name != albedo_name:
            raise ValueError("workwearAlbedo must name a local texture")
        fabric = mat.copy()
        shader = next(n for n in fabric.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        tex = shader.inputs["Base Color"].links[0].from_node
        tex.image = bpy.data.images.load(str(folder / albedo_name), check_existing=True)
    fabric.name = "Ida's scanned workwear"
    for category, name in enumerate(
        (
            "Cloth_jacket",
            "Cloth_tshirt",
            "Cloth_jeans",
            "Cloth_shoes",
            "Captured jaw and neckline",
        )
    ):
        include = np.flatnonzero(parts == category)
        if not len(include):
            continue
        ids, faces = np.unique(tri[include].ravel(), return_inverse=True)
        panel = bpy.data.meshes.new(name + " fitted scan")
        panel.from_pydata(dest[ids], [], faces.reshape(-1, 3))
        panel.update()
        garment = bpy.data.objects.new(name, panel)
        bpy.context.scene.collection.objects.link(garment)
        garment["scanWorkwear"] = True
        material = fabric
        neck_atlas = folder / "captured-neck.jpg"
        if category == 4:
            material = mat.copy()
            material.name = "Photographed jaw and neckline"
            tree = material.node_tree
            shader = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
            if neck_atlas.is_file():
                tex = shader.inputs["Base Color"].links[0].from_node
                tex.image = bpy.data.images.load(str(neck_atlas), check_existing=True)
        panel.materials.append(material)
        uvmap = panel.uv_layers.new(name="UVMap")
        uvmap.data.foreach_set("uv", uv[include].astype("f").ravel())
        panel.polygons.foreach_set(
            "use_smooth", np.ones(len(panel.polygons), dtype=bool)
        )
        panel.normals_split_custom_set(normals[include].reshape(-1, 3))
        for bone, values in groups.items():
            active = np.flatnonzero(values[ids] > 0.00001)
            if not len(active):
                continue
            group = garment.vertex_groups.new(name=bone)
            for ix in active:
                group.add([int(ix)], float(values[ids[ix]]), "REPLACE")
        garment.parent = rig
        mod = garment.modifiers.new("Fitted anatomical skeleton", "ARMATURE")
        mod.object = rig
        print("SCAN WORKWEAR", name, len(ids), len(include))
    exposed_anatomy(rig, face_ids)
    for o in added:
        bpy.data.objects.remove(o, do_unlink=True)
