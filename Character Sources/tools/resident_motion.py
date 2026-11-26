"""Retarget measured motion to the resident skeleton and bind playable Blender actions."""

import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[1]
MOTION = ROOT / "Motion"
CATALOG = json.loads((MOTION / "catalog.json").read_text())
JOINTS = {
    "pelvis": ("Hips", None),
    "spine_01": ("LowerBack", None),
    "spine_02": ("Spine", None),
    "spine_03": ("Spine1", None),
    "neck_01": ("Neck1", None),
    "head": ("Head", None),
}
for side, prefix in (("l", "Left"), ("r", "Right")):
    for joint, start, end in (
        ("clavicle", "Shoulder", "Arm"),
        ("upperarm", "Arm", "ForeArm"),
        ("lowerarm", "ForeArm", "Hand"),
        ("hand", "Hand", "HandIndex1"),
        ("thigh", "UpLeg", "Leg"),
        ("calf", "Leg", "Foot"),
        ("foot", "Foot", "ToeBase"),
        ("ball", "ToeBase", "ToeBaseEnd"),
    ):
        JOINTS[joint + "_" + side] = (prefix + start, prefix + end)


def captured(rig, key):
    with np.load(MOTION / (key + ".npz")) as take:
        names, rest, positions, rotations = (
            take[k] for k in ("names", "rest", "positions", "rotations")
        )
    idx = {name: i for i, name in enumerate(names)}
    bones = rig.data.bones
    target_lengths = sum(bones[k].length for k in ("thigh_l", "calf_l"))
    source_lengths = sum(
        np.linalg.norm(rest[idx[b]] - rest[idx[a]])
        for a, b in (("LeftUpLeg", "LeftLeg"), ("LeftLeg", "LeftFoot"))
    )
    scale = target_lengths / source_lengths
    floor = np.percentile(
        positions[:, [idx["LeftToeBase"], idx["RightToeBase"]], 2].min(axis=1), 2
    )
    translation = positions[:, 0].astype(float) * scale
    translation[:, 2] -= (
        floor * scale + bones["pelvis"].head_local.z - bones["ball_l"].head_local.z
    )
    output = {"location": translation}
    rest_axis = {b.name: b.matrix_local.to_quaternion() for b in bones}
    worlds = {}
    for b in bones:
        if b.name not in JOINTS:
            continue
        start, end = JOINTS[b.name]
        src = idx[start]
        correction = Quaternion()
        if end and not b.name.startswith("clavicle_"):
            goal = Vector(rest[idx[end]] - rest[src]).normalized()
            native = (b.tail_local - b.head_local).normalized()
            if b.name.startswith("hand_"):
                native = (
                    bones["middle_01_" + b.name[-1]].head_local - b.head_local
                ).normalized()
            correction = native.rotation_difference(goal)
        parent = b.parent.name
        relative = rest_axis[parent].inverted() @ rest_axis[b.name]
        parent_motion = worlds.get(parent)
        qs = []
        world = []
        for i, rotation in enumerate(rotations[:, src]):
            q = (
                Matrix(rotation.tolist()).to_quaternion()
                @ correction
                @ rest_axis[b.name]
            )
            p = parent_motion[i] if parent_motion else rest_axis[parent]
            if b.name.startswith("clavicle_"):
                # CMU's shoulder starts at the midline of the torso. Our clavicle
                # starts at the sternoclavicular joint and has a different resting slope.
                q = (p @ relative).slerp(q, 0.55)
            local = relative.inverted() @ p.inverted() @ q
            if qs:
                local.make_compatible(qs[-1])
            qs.append(local)
            world.append(q)
        worlds[b.name] = world
        output[b.name] = np.asarray(qs)
    return output


def portion(track, start, stop, count=None):
    sample = np.linspace(start, stop - 1, count or stop - start)
    out = {}
    for name, values in track.items():
        series = np.asarray(
            [np.interp(sample, np.arange(len(values)), col) for col in values.T]
        ).T
        if name != "location":
            series /= np.linalg.norm(series, axis=1)[:, None]
        out[name] = series
    return out


def sequence(parts, overlap=7):
    stitched = {k: v.copy() for k, v in parts[0].items()}
    for part in parts[1:]:
        for k, right in part.items():
            left = stitched[k]
            n = min(overlap, len(right), len(left))
            t = np.linspace(0, 1, n)[:, None]
            t = t * t * (3 - 2 * t)
            right = right.copy()
            if k == "location":
                right[:, :2] += left[-1, :2] - right[0, :2]
            elif np.dot(left[-n], right[0]) < 0:
                right *= -1
            fade = left[-n:] * (1 - t) + right[:n] * t
            if k != "location":
                fade /= np.linalg.norm(fade, axis=1)[:, None]
            stitched[k] = np.concatenate((left[:-n], fade, right[n:]))
    return stitched


def stage_action(rig, kind):
    # An authored game gesture and an acted recoil. Both begin and end in idle.
    take = portion(captured(rig, "idle_shift"), 0, 32)
    poses = {
        "attack": {
            "upperarm_r": (0.6, 0.15, 0.9),
            "lowerarm_r": (0.35, 0, -0.28),
            "spine_03": (0.05, 0.32, 0.12),
            "clavicle_r": (0.12, 0.08, 0.16),
        },
        "flinch": {
            "head": (-0.23, 0.12, 0.06),
            "spine_03": (-0.23, 0.03, 0.15),
            "upperarm_l": (0.41, 0.15, -0.25),
            "upperarm_r": (0.3, -0.12, 0.24),
        },
    }
    strength = np.interp(
        np.arange(32), [0, 5, 10, 13, 19, 31], [0, -0.18, 0.55, 1, 0.52, 0]
    )
    from mathutils import Euler

    for k, angles in poses[kind].items():
        take[k] = np.array(
            [
                Quaternion(q) @ Euler(tuple(t * a for a in angles)).to_quaternion()
                for q, t in zip(take[k], strength)
            ]
        )
    return take


def write_action(rig, name, track):
    action = bpy.data.actions.new(name)
    slot = action.slots.new("OBJECT", rig.name)
    layer = action.layers.new("Body")
    bag = layer.strips.new(type="KEYFRAME").channelbag(slot, ensure=True)
    for key, values in track.items():
        path = (
            "location"
            if key == "location"
            else rig.pose.bones[key].path_from_id("rotation_quaternion")
        )
        frames = np.arange(1, len(values) + 1)
        for axis, column in enumerate(values.T):
            curve = bag.fcurves.new(path, index=axis)
            curve.keyframe_points.add(len(frames))
            curve.keyframe_points.foreach_set(
                "co", np.column_stack((frames, column)).astype("f").ravel()
            )
            for point in curve.keyframe_points:
                point.interpolation = "LINEAR"
            curve.update()
    action.use_fake_user = True
    action.asset_mark()
    return action


def activate(rig, action):
    rig.animation_data_create()
    rig.animation_data.action = action
    rig.animation_data.action_slot = action.slots[0]
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
        bone.rotation_mode = "QUATERNION"
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = map(int, action.frame_range)
    scene.render.fps = 24
    scene.frame_set(scene.frame_start)


def attach_library():
    rig = bpy.data.objects["Resident rig"]
    mesh = bpy.data.objects["Body"].data
    for key in [*CATALOG, "attack", "flinch"]:
        field = "motion_" + key
        if field in mesh:
            previous = mesh[field]
            del mesh[field]
            bpy.data.actions.remove(previous)
        track = captured(rig, key) if key in CATALOG else stage_action(rig, key)
        action = write_action(rig, "City | " + key, track)
        action["motionId"] = key
        action["source"] = CATALOG[key]["trial"] if key in CATALOG else "Authored"
        mesh[field] = action


def library_action(rig, key):
    return next(
        o.data["motion_" + key]
        for o in bpy.context.scene.objects
        if o.type == "MESH" and o.find_armature() == rig and "motion_" + key in o.data
    )


def ground_action(scene, rig, action, include_body=False):
    # The fitted leg lengths and shoe outsole differ from the capture performer.
    shoes = next(o for o in scene.objects if o.name in ("Cloth_shoes", "Cloth_boots"))
    objects = [shoes]
    if include_body:
        objects += [
            o
            for o in scene.objects
            if o.name in ("Body", "Cloth_jacket", "Cloth_jeans")
        ]
    correction = []
    for frame in range(1, scene.frame_end + 1):
        scene.frame_set(frame)
        heights = []
        for obj in objects:
            evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
            co = np.empty(len(evaluated.data.vertices) * 3, dtype="f")
            evaluated.data.vertices.foreach_get("co", co)
            transform = np.asarray(evaluated.matrix_world)
            heights.append(
                (co.reshape(-1, 3) @ transform[2, :3] + transform[2, 3]).min()
            )
        lowest = min(heights)
        correction.append(-lowest)
    bag = action.layers[0].strips[0].channelbag(action.slots[0])
    curve = bag.fcurves.find("location", index=2)
    for pt, delta in zip(curve.keyframe_points, correction):
        pt.co.y += float(delta)
    curve.update()
    scene.frame_set(1)


def pin_support(scene, rig, action):
    shoes = next(o for o in scene.objects if o.name in ("Cloth_shoes", "Cloth_boots"))
    left = np.array([v.co.x > 0 for v in shoes.data.vertices])
    previous = None
    compensation = np.zeros((scene.frame_end, 2))
    for frame in range(1, scene.frame_end + 1):
        scene.frame_set(frame)
        mesh = shoes.evaluated_get(bpy.context.evaluated_depsgraph_get())
        co = np.empty(len(left) * 3, dtype="f")
        mesh.data.vertices.foreach_get("co", co)
        m = np.asarray(mesh.matrix_world)
        xyz = co.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3]
        if previous is not None:
            contact = (xyz[:, 2] < 0.009) & (previous[:, 2] < 0.009)
            candidates = [
                np.median((xyz - previous)[foot & contact, :2], axis=0)
                for foot in (left, ~left)
                if (foot & contact).any()
            ]
            if candidates:
                compensation[frame - 1] = -min(candidates, key=np.linalg.norm)
        previous = xyz
    corrections = np.cumsum(compensation, axis=0)
    curves = action.layers[0].strips[0].channelbag(action.slots[0]).fcurves
    for axis in (0, 1):
        curve = curves.find("location", index=axis)
        for pt, delta in zip(curve.keyframe_points, corrections[:, axis]):
            pt.co.y += float(delta)
        curve.update()
    scene.frame_set(1)
