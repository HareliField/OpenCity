"""Fit the two performed arms and curled fingers to a rigid pair of handles."""

import math
import numpy as np
from mathutils import Matrix, Quaternion, Vector


def axes(forward, across):
    forward = forward.normalized()
    across = (across - forward * across.dot(forward)).normalized()
    return Matrix([forward, across, forward.cross(across)]).transposed().to_quaternion()


def smooth(value):
    value = min(1.0, max(0.0, value))
    return value * value * (3 - 2 * value)


def fit_handles(rig, track, phase, span):
    bones = rig.data.bones
    rest = {
        b.name: b.parent.matrix_local.inverted() @ b.matrix_local
        if b.parent
        else b.matrix_local.copy()
        for b in bones
    }
    for b in bones:
        if b.name not in track and b.name.startswith(
            ("thumb_", "index_", "middle_", "ring_", "pinky_")
        ):
            track[b.name] = np.tile([1.0, 0, 0, 0], (len(track["location"]), 1))
    poses = {}
    for frame in range(len(track["location"])):

        def inherited(name):
            b = bones[name]
            return poses[b.parent.name] @ rest[name] if b.parent else rest[name]

        def update(name):
            poses[name] = (
                inherited(name)
                @ (Quaternion(track[name][frame]) if name in track else Quaternion())
                .to_matrix()
                .to_4x4()
            )

        def rotate(name, wanted, amount):
            q = inherited(name).to_quaternion().inverted() @ wanted
            old = Quaternion(track[name][frame])
            q = old.slerp(q, amount)
            if frame:
                q.make_compatible(Quaternion(track[name][frame - 1]))
            track[name][frame] = tuple(q)
            update(name)

        def head(name):
            return poses[name].translation

        for b in bones:
            update(b.name)
        left_shoulder, right_shoulder = head("upperarm_l"), head("upperarm_r")
        across = left_shoulder - right_shoulder
        across.z = 0
        across.normalize()
        forward = Vector((across.y, -across.x, 0))
        up = Vector((0, 0, 1))
        shoulders = (left_shoulder + right_shoulder) * 0.5
        source = (head("middle_02_l") + head("middle_02_r")) * 0.5
        elapsed = frame if phase == "lift" else len(track["location"]) - 1 - frame
        progress = elapsed / max(1, len(track["location"]) - 1)
        loading = 1 if phase == "carry" else smooth(progress / 0.42)
        raised = 1 if phase == "carry" else smooth((progress - 0.55) / 0.45)
        center = shoulders + forward * (0.195 + 0.105 * raised)
        center.z = source.z * (1 - raised) + (shoulders.z - 0.43) * raised
        for side, sign in (("l", 1), ("r", -1)):
            upper, lower, hand = (
                part + "_" + side for part in ("upperarm", "lowerarm", "hand")
            )
            first = "middle_01_" + side
            second = "middle_02_" + side
            raw_forward = bones[first].head_local - bones[hand].head_local
            raw_across = (
                bones["pinky_01_" + side].head_local
                - bones["index_01_" + side].head_local
            )
            aim = (-sign * 0.40 * across + forward * 0.07 - 0.91 * up).normalized()
            orient = axes(aim, -forward) @ axes(raw_forward, raw_across).inverted()
            hand_pose = orient @ bones[hand].matrix_local.to_quaternion()
            proximal = (-sign * 0.52 * across - 0.85 * up + 0.04 * forward).normalized()
            handle = center + sign * 0.5 * span * across
            pip_offset = (
                orient @ raw_forward
                + proximal * (bones[second].head_local - bones[first].head_local).length
            )
            wrist = handle - pip_offset
            shoulder = head(upper)
            ray = wrist - shoulder
            distance = ray.length
            ray.normalize()
            l1 = (bones[lower].head_local - bones[upper].head_local).length
            l2 = (bones[hand].head_local - bones[lower].head_local).length
            reach = min(l1 + l2 - 0.0001, max(abs(l1 - l2) + 0.0001, distance))
            along = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach)
            # Elbows tuck beside the ribs and stay behind each handle.
            pole = sign * 0.18 * across - 0.88 * forward - 0.23 * up
            pole = (pole - ray * pole.dot(ray)).normalized()
            elbow = (
                shoulder
                + along * ray
                + math.sqrt(max(0, l1 * l1 - along * along)) * pole
            )
            for name, child, goal in ((upper, lower, elbow), (lower, hand, wrist)):
                update(name)
                update(child)
                current = poses[name].to_quaternion()
                initial = (head(child) - head(name)).normalized()
                desired = (goal - head(name)).normalized()
                rotate(name, initial.rotation_difference(desired) @ current, loading)
            rotate(hand, hand_pose, loading)
            for digit in ("index", "middle", "ring", "pinky", "thumb"):
                for i in (1, 2, 3):
                    key = f"{digit}_0{i}_{side}"
                    if key not in poses:
                        continue
                    update(key)
                    if digit == "thumb":
                        direction = (
                            (-0.32 * sign * across + 0.83 * forward - 0.44 * up)
                            if i == 1
                            else (-0.83 * sign * across - 0.23 * forward - 0.36 * up)
                        )
                    else:
                        direction = (
                            proximal,
                            -sign * 0.83 * across + 0.56 * up,
                            sign * 0.30 * across + 0.95 * up,
                        )[i - 1]
                    current = poses[key].to_quaternion()
                    initial = current @ Vector((0, 1, 0))
                    wanted = (
                        initial.rotation_difference(direction.normalized()) @ current
                    )
                    rotate(key, wanted, loading)
