"""Fit a rooted counter stance, a heel-to-toe work stride and free hand shapes."""

import json
import math

import bpy
import numpy as np
from mathutils import Euler, Quaternion, Vector
from recovery_contact import DIGITS, plane_orientation, positions, region, smooth
from resident_motion import activate, write_action

TAU = 2 * math.pi
rad = math.radians


def set_world(bone, rotation):
    rest = (
        bone.parent.bone.matrix_local.to_quaternion().inverted()
        @ bone.bone.matrix_local.to_quaternion()
    )
    bone.rotation_quaternion = (
        bone.parent.matrix.to_quaternion() @ rest
    ).inverted() @ rotation
    bpy.context.view_layer.update()


def aim(bone, direction):
    """Orient the native limb in the sagittal plane while retaining its roll."""
    native = bone.bone.tail_local - bone.bone.head_local
    pitch = math.atan2(direction.y, -direction.z) - math.atan2(native.y, -native.z)
    swing = Quaternion((1, 0, 0), pitch)
    orient = (swing @ native).rotation_difference(direction) @ swing
    set_world(bone, orient @ bone.bone.matrix_local.to_quaternion())


def shoe_region(shoe, side):
    # The heel of the captured work boot shares weight with the lower shin,
    # while the articulated forefoot is weighted predominantly to the ball.
    return region(shoe, {part + "_" + side for part in ("calf", "foot", "ball")}, 0.55)


def bend_leg(rig, side, ankle_goal, shoe, sole, heel, toe, clearance):
    bones = rig.pose.bones
    thigh, shin, foot, ball = [
        bones[n + "_" + side] for n in ("thigh", "calf", "foot", "ball")
    ]
    hip = rig.matrix_world @ thigh.head
    hip_length = (shin.bone.head_local - thigh.bone.head_local).length
    shin_length = (foot.bone.head_local - shin.bone.head_local).length
    sign = 1 if side == "l" else -1
    for _ in range(4):
        axis = ankle_goal - hip
        reach = min(axis.length, hip_length + shin_length - 0.0002)
        axis.normalize()
        bend = Vector((sign * 0.10, -1.0, 0.0))
        bend = (bend - axis * bend.dot(axis)).normalized()
        along = (hip_length**2 - shin_length**2 + reach**2) / (2 * reach)
        knee = hip + axis * along + bend * math.sqrt(max(0, hip_length**2 - along**2))
        aim(thigh, knee - hip)
        aim(shin, hip + reach * axis - knee)
        set_world(foot, heel @ foot.bone.matrix_local.to_quaternion())
        set_world(ball, toe @ ball.bone.matrix_local.to_quaternion())
        error = clearance - float(positions(shoe)[sole, 2].min())
        if abs(error) < 0.00025:
            break
        ankle_goal.z += error


def foot_step(phase, side, photo):
    sign = 1 if side == "l" else -1
    clearance = 0.0012
    if photo:
        ankle_x = photo["ankle_" + side].x
        toe_direction = photo["toe_" + side].x - ankle_x
        yaw = Quaternion((0, 0, 1), math.atan2(toe_direction, 0.215))
        goal = Vector((ankle_x, -0.023 if side == "l" else 0.015, 0.083 + clearance))
        return goal, yaw, yaw, clearance
    p = (phase + (0.0 if side == "l" else 0.5)) % 1
    stance = 0.61
    stride = 1.045
    y = -0.285 + stride * p
    x = sign * 0.096
    if p <= stance:
        # A short heel rocker at loading, then a longer forefoot rocker at push-off.
        heel_angle = -12 * (1 - smooth(p / 0.115)) + 34 * smooth(
            (p - 0.37) / (0.61 - 0.37)
        )
        toe_angle = min(4, heel_angle)
    else:
        t = (p - stance) / (1 - stance)
        # Match the trailing velocity at takeoff and landing so the foot reverses smoothly.
        y = (
            -0.285
            + stride * stance * (1 - smooth(t))
            + stride * (1 - stance) * t * (1 - t) * (1 - 2 * t)
        )
        arc = math.sin(math.pi * t) ** 2
        x += sign * 0.021 * arc
        clearance += (0.071 if side == "l" else 0.066) * arc
        heel_angle = 34 - 46 * smooth(t / 0.82)
        toe_angle = (1 - smooth(t / 0.23)) * 4 + smooth(t / 0.23) * heel_angle
    # Preserve the heel and ball's position as the ankle rotates around them.
    pivot = Vector((0, -0.16 if heel_angle > 0 else 0.045, -0.074))
    yaw = Quaternion((0, 0, 1), rad(sign * 7))
    heel = yaw @ Quaternion((1, 0, 0), rad(heel_angle))
    offset = yaw @ pivot - heel @ pivot
    x += offset.x
    y += offset.y
    toe = yaw @ Quaternion((1, 0, 0), rad(toe_angle))
    return Vector((x, y, 0.083 + clearance)), heel, toe, clearance


def body(rig, phase, walking):
    bones = rig.pose.bones
    a = TAU * phase
    weight = math.sin(a + (0.0 if walking else -0.6))
    stride = math.cos(a)
    # Moving weight arrives on the stance side after heel contact. In the counter
    # stance the right foot bears slightly more, with both soles staying put.
    x = 0.024 * weight if walking else -0.002 + 0.005 * weight
    half_step = (phase * 2) % 1
    z = (
        (
            0.997
            + 0.031 * math.sin(math.pi * (half_step - 0.08)) ** 2
            - 0.010 * math.exp(-(((half_step - 0.19) / 0.14) ** 2))
        )
        if walking
        else 1.029 + 0.0012 * weight
    )
    pitch = rad(2.7 if walking else 1.3)
    hip_tilt = rad(-2.3 * weight if walking else 0.9 - 0.7 * weight)
    twist = rad(-4.5 * stride if walking else 0.8 + 0.9 * weight)
    pelvis = bones["pelvis"]
    set_world(
        pelvis,
        Euler((pitch, hip_tilt, twist)).to_quaternion()
        @ pelvis.bone.matrix_local.to_quaternion(),
    )
    rig.location += Vector((x, 0.006, z)) - rig.matrix_world @ pelvis.head
    bpy.context.view_layer.update()
    for joint, follow in [
        ("spine_01", 0.62),
        ("spine_02", 0.19),
        ("spine_03", -0.53),
        ("neck_01", -0.14),
        ("head", -0.04),
    ]:
        bone = bones[joint]
        gaze = rad(2.2 * math.sin(a - 0.45)) if joint == "head" and not walking else 0
        inclination = pitch * (0.70 if joint in ("head", "neck_01") else 1.0)
        orientation = Euler(
            (inclination, follow * hip_tilt, follow * twist + gaze)
        ).to_quaternion()
        set_world(bone, orientation @ bone.bone.matrix_local.to_quaternion())


def casting_targets(folder, scene):
    """Register the original photograph to the floor and crown in the fitted rig."""
    fit = json.loads((folder / "photo-fit.json").read_text())
    casting = json.loads((folder / "art-direction.json").read_text())["performance"][
        "castingView"
    ]
    crowns = (casting["crownMesh"], *casting.get("alternateCrownMeshes", ()))
    head = next(
        (scene.objects.get(name) for name in crowns if name in scene.objects), None
    )
    if head is None:
        raise ValueError(f"No fitted crown mesh for casting registration: {crowns}")
    # The groom follows the head bone. Register the same bind-pose crown whether
    # the caller has a captured approach, a planted idle or a rest pose active.
    rig = (
        head.parent
        if head.parent and head.parent.type == "ARMATURE"
        else head.find_armature()
    )
    if rig:
        original_pose = rig.data.pose_position
        try:
            rig.data.pose_position = "REST"
            bpy.context.view_layer.update()
            crown_in_rig = rig.matrix_world.inverted() @ head.matrix_world
        finally:
            rig.data.pose_position = original_pose
            bpy.context.view_layer.update()
    else:
        crown_in_rig = head.matrix_world.copy()
    height = max((crown_in_rig @ v.co).z for v in head.data.vertices)
    scale_y = height / (casting["soleY"] - casting["crownY"])
    width, height_px = fit["sourcePixels"]
    scale_x = scale_y * width / height_px
    anchors = fit["bodyAnchors"]
    targets = {}
    for side, ids in (("l", (11, 13, 15, 27, 31)), ("r", (12, 14, 16, 28, 32))):
        for part, i in zip(("shoulder", "elbow", "wrist", "ankle", "toe"), ids):
            u, v = anchors[str(i)]
            if part == "ankle":
                u, v = casting["shoeCollars"][side]
            targets[part + "_" + side] = Vector(
                (
                    (u - casting["centerX"]) * scale_x,
                    0.0,
                    (casting["soleY"] - v) * scale_y,
                )
            )
    for name, (u, v) in casting["fingertips"].items():
        targets[name] = Vector(
            ((u - casting["centerX"]) * scale_x, 0.0, (casting["soleY"] - v) * scale_y)
        )
    return targets, (casting, scale_x, scale_y)


def photo_arm(rig, side, photo, breath):
    """Fit the elbow and wrist to the frontal casting marks at fixed bone lengths."""
    bones = rig.pose.bones
    clavicle, upper, lower, hand = [
        bones[name + "_" + side]
        for name in ("clavicle", "upperarm", "lowerarm", "hand")
    ]
    origin = rig.matrix_world @ clavicle.head
    elbow = photo["elbow_" + side].copy()
    elbow.y = origin.y + 0.023 + 0.004 * breath
    axis = elbow - origin
    length_c = (upper.bone.head_local - clavicle.bone.head_local).length
    length_u = (lower.bone.head_local - upper.bone.head_local).length
    reach = min(axis.length, length_c + length_u - 0.0001)
    axis.normalize()
    along = (length_c**2 - length_u**2 + reach**2) / (2 * reach)
    observed = photo["shoulder_" + side] - origin
    observed.y = 0.015
    normal = (observed - axis * observed.dot(axis)).normalized()
    shoulder = (
        origin + along * axis + math.sqrt(max(0.0, length_c**2 - along**2)) * normal
    )
    for bone, child, goal in ((clavicle, upper, shoulder), (upper, lower, elbow)):
        old = child.head - bone.head
        delta = goal - rig.matrix_world @ bone.head
        set_world(bone, old.rotation_difference(delta) @ bone.matrix.to_quaternion())
    goal = photo["wrist_" + side] - rig.matrix_world @ lower.head
    length = (hand.bone.head_local - lower.bone.head_local).length
    goal.y = -math.sqrt(max(0.0, length**2 - goal.x**2 - goal.z**2))
    aim(lower, goal)
    return goal.normalized()


def arms(rig, phase, walking, measured_swing=None, photo=None):
    bones = rig.pose.bones
    for side, sign in [("l", 1), ("r", -1)]:
        upper, lower, hand = [
            bones[n + "_" + side] for n in ("upperarm", "lowerarm", "hand")
        ]
        a = TAU * (phase + (0 if side == "l" else 0.5))
        swing = math.cos(a - 0.12) if walking else 0.07 * math.sin(a)
        reach = 0.165 if side == "l" else 0.19
        # Shoulder, elbow and wrist reverse in sequence. The forearm remains
        # flexed in front of the elbow even at the backward end of the swing.
        elbow_swing = math.cos(a - 0.34) if walking else 0.08 * math.sin(a - 0.4)
        if measured_swing is not None:
            swing, elbow_swing = (sign * v for v in measured_swing)
        upper_dir = Vector((sign * 0.108, 0.032 + reach * swing, -1)).normalized()
        lower_dir = Vector((sign * 0.040, -0.183 + 0.22 * elbow_swing, -1)).normalized()
        if photo:
            lower_dir = photo_arm(rig, side, photo, math.sin(a))
        else:
            aim(upper, upper_dir)
            aim(lower, lower_dir)
        rest_forward = bones["middle_01_" + side].bone.head_local - hand.bone.head_local
        rest_across = (
            bones["pinky_01_" + side].bone.head_local
            - bones["index_01_" + side].bone.head_local
        )
        rest_dorsum = rest_forward.cross(rest_across) * sign
        wrist_forward = Vector(
            (-sign * (0.16 if photo else 0.045), lower_dir.y * 0.80, -1)
        ).normalized()
        outward = Vector((sign * 0.96, (-0.40 if photo else -0.23) - 0.07 * swing, 0))
        orientation = (
            plane_orientation(wrist_forward, outward)
            @ plane_orientation(rest_forward, rest_dorsum).inverted()
        )
        set_world(hand, orientation @ hand.bone.matrix_local.to_quaternion())


def fit_story_arms(rig, track, walking, photo=None):
    """Follow the weight transfer of a recorded approach or its final resting beat."""
    scene = bpy.context.scene
    action = write_action(rig, "Fit storytelling arms", track)
    activate(rig, action)
    delayed = None
    for f in range(len(track["location"])):
        scene.frame_set(f + 1)
        feet = rig.pose.bones["foot_r"].head.y - rig.pose.bones["foot_l"].head.y
        swing = max(-1, min(1, feet / 0.57)) if walking else 0.0
        delayed = swing if delayed is None else 0.55 * delayed + 0.45 * swing
        arms(rig, 0, walking, (swing, delayed), photo)
        for side in "lr":
            for part in ("clavicle", "upperarm", "lowerarm", "hand"):
                name = part + "_" + side
                q = rig.pose.bones[name].rotation_quaternion.copy()
                if f:
                    q.make_compatible(Quaternion(track[name][f - 1]))
                track[name][f] = tuple(q)
    bpy.data.actions.remove(action)


def fingers(rig, track, frame, phase, activity, opening=0.0):
    """Use each finger's measured flexion plane, including thumb opposition."""
    bones = rig.data.bones
    # Incremental MCP, PIP and DIP flexion above each finger's own rest shape.
    flexion = {
        "index": (5, 11, 5),
        "middle": (9, 16, 8),
        "ring": (14, 19, 10),
        "pinky": (18, 21, 12),
        "thumb": (5, 6, 3),
    }
    for side, sign in [("l", 1), ("r", -1)]:
        forward = (
            bones["middle_01_" + side].head_local - bones["hand_" + side].head_local
        )
        across = (
            bones["pinky_01_" + side].head_local - bones["index_01_" + side].head_local
        )
        palmar = -sign * forward.cross(across).normalized()
        for d, digit in enumerate(DIGITS):
            a = TAU * phase + (0 if side == "r" else math.pi) - 0.19 * d
            wave = math.sin(a)
            scale = 1.0 + (0.12 if activity == "work_stride" else 0.17) * wave
            if activity == "listening_hands":
                scale = (
                    1
                    + (0.38 if side == "r" and digit in ("index", "thumb") else 0.16)
                    * wave
                )
            if activity == "counter_rest":
                scale *= 0.73
            scale *= 1 - (0.79 if digit == "thumb" else 0.90) * opening
            for j, angle in enumerate(flexion[digit], 1):
                name = f"{digit}_0{j}_{side}"
                bone = bones[name]
                direction = (bone.tail_local - bone.head_local).normalized()
                inward = palmar
                if digit == "thumb":
                    inward = (
                        0.63 * palmar
                        + 0.77
                        * (
                            bones["middle_01_" + side].head_local - bone.head_local
                        ).normalized()
                    ).normalized()
                axis = (
                    bone.matrix_local.to_quaternion().inverted()
                    @ direction.cross(inward).normalized()
                )
                q = Quaternion(
                    axis, rad(angle * scale * (0.95 if side == "l" else 1.0))
                )
                if name not in track:
                    track[name] = np.tile(
                        (1.0, 0.0, 0.0, 0.0), (len(track["location"]), 1)
                    )
                track[name][frame] = tuple(q)


def fit_resting_digits(rig, track, f, photo):
    """Fit the photographed long fingertip and opposing thumb after the relaxed curls."""
    bones = rig.pose.bones
    for side in "lr":
        names = [f"{d}_0{j}_{side}" for d in DIGITS for j in (1, 2, 3)]
        for name in names:
            bones[name].rotation_quaternion = Quaternion(track[name][f])
        bpy.context.view_layer.update()
        for part, joint, maximum in (("middle", "hand", 26), ("thumb", "thumb_01", 46)):
            root = bones[joint + "_" + side]
            end = bones[part + "_03_" + side]
            pivot = rig.matrix_world @ root.head
            ray = rig.matrix_world @ end.tail - pivot
            goal = photo[part + "_" + side] - pivot
            # The front photograph constrains x/z. Use the old digit's side of
            # the palm for the remaining depth rather than flattening its joints.
            depth = math.sqrt(max(0.0, ray.length_squared - goal.x**2 - goal.z**2))
            goal.y = math.copysign(depth, ray.y)
            turn = ray.rotation_difference(goal)
            if turn.angle > rad(maximum):
                turn = Quaternion(turn.axis, rad(maximum))
            set_world(root, turn @ root.matrix.to_quaternion())
            track[root.name][f] = tuple(root.rotation_quaternion)


def fit_performance(rig, track, activity, folder):
    photo = (
        casting_targets(folder, bpy.context.scene)[0]
        if activity == "counter_rest"
        else None
    )
    if activity not in ("counter_rest", "work_stride", "listening_hands"):
        raise ValueError(f"Unknown resident performance {activity}")
    count = len(track["location"])
    if activity == "listening_hands":
        for f in range(count):
            p = f / max(1, count - 1)
            opening = smooth(p / 0.26) * smooth((0.92 - p) / 0.27)
            fingers(rig, track, f, p, activity, opening)
        return
    scene = bpy.context.scene
    action = write_action(rig, "Fit workday performance", track)
    activate(rig, action)
    shoe = scene.objects["Cloth_shoes"]
    soles = {s: shoe_region(shoe, s) for s in "lr"}
    joints = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"]
    joints += [
        part + "_" + s
        for part in (
            "clavicle",
            "upperarm",
            "lowerarm",
            "hand",
            "thigh",
            "calf",
            "foot",
            "ball",
        )
        for s in "lr"
    ]
    for f in range(count):
        scene.frame_set(f + 1)
        phase = f / max(1, count - 1)
        walking = activity == "work_stride"
        body(rig, phase, walking)
        arms(rig, phase, walking, photo=photo)
        for side in "lr":
            goal, heel, toe, clearance = foot_step(phase, side, photo)
            bend_leg(rig, side, goal, shoe, soles[side], heel, toe, clearance)
        track["location"][f] = tuple(rig.location)
        for name in joints:
            q = rig.pose.bones[name].rotation_quaternion.copy()
            if f:
                q.make_compatible(Quaternion(track[name][f - 1]))
            track[name][f] = tuple(q)
        fingers(rig, track, f, phase, activity)
        if photo:
            fit_resting_digits(rig, track, f, photo)
    bpy.data.actions.remove(action)
