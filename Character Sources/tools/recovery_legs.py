"""Transfer Ida's prone get-up from knees and toes onto a staggered pair of soles."""

import math

import bpy
import numpy as np
from mathutils import Quaternion, Vector
from recovery_contact import UP, positions, region, smooth, write_curves


def ease_upper_capture(scene, rig, action, start, stop):
    """Filter brief recoil jitter before solving the hands against the tile."""
    names = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"]
    names += [
        part + "_" + s
        for part in ("clavicle", "upperarm", "lowerarm", "hand")
        for s in "lr"
    ]
    frames = list(range(max(1, start - 6), min(stop, start + 82) + 1))
    rotations = {name: [] for name in names}
    for f in frames:
        scene.frame_set(f)
        for name in names:
            q = rig.pose.bones[name].rotation_quaternion.copy()
            if rotations[name]:
                q.make_compatible(rotations[name][-1])
            rotations[name].append(q)
    updates = {}
    taps = np.exp(-0.5 * (np.arange(-6, 7) / 2.8) ** 2)
    for name, samples in rotations.items():
        raw = np.array(samples)
        padded = np.pad(raw, ((6, 6), (0, 0)), mode="edge")
        for i, f in enumerate(frames):
            q = Quaternion(
                np.average(padded[i : i + 13], axis=0, weights=taps)
            ).normalized()
            amount = smooth(i / 6) * smooth((len(frames) - 1 - i) / 5)
            updates.setdefault(name, {})[f] = samples[i].slerp(q, amount)
    write_curves(action, rig, updates)


def pelvis_path(scene, rig, action, start, stop):
    finish = min(stop, start + 82)
    if finish < start + 72:
        return
    pelvis = rig.pose.bones["pelvis"]

    def pelvis_at(frame):
        scene.frame_set(frame)
        return rig.matrix_world @ pelvis.head

    first = pelvis_at(start + 29)
    last = pelvis_at(finish)
    points = np.array(
        [
            first,
            first + Vector((-0.045, 0.21, 0.16)),
            first + Vector((-0.072, 0.36, 0.24)),
            first + Vector((-0.030, 0.47, 0.32)),
            first + Vector((0.032, 0.54, 0.47)),
            last,
        ]
    )
    times = np.array([29, 36, 44, 53, 64, finish - start])
    slopes = np.gradient(points, times, axis=0)
    slopes[0] = np.asarray(first - pelvis_at(start + 28))
    slopes[-1] = 0
    curves = action.layers[0].strips[0].channelbag(action.slots[0]).fcurves
    channels = [curves.find("location", index=i) for i in range(3)]
    for f in range(start + 30, finish + 1):
        dt = f - start
        i = min(len(times) - 2, np.searchsorted(times, dt, side="right") - 1)
        span = times[i + 1] - times[i]
        t = (dt - times[i]) / span
        # Hermite interpolation carries the incoming hip velocity through the press.
        target = (
            (2 * t**3 - 3 * t * t + 1) * points[i]
            + (t**3 - 2 * t * t + t) * span * slopes[i]
            + (-2 * t**3 + 3 * t * t) * points[i + 1]
            + (t**3 - t * t) * span * slopes[i + 1]
        )
        offset = target - np.asarray(pelvis_at(f))
        for axis, curve in enumerate(channels):
            curve.keyframe_points[f - 1].co.y += offset[axis]
    for curve in channels:
        curve.update()


def leg_pose(
    rig, side, original, target, knee_direction, foot_rotation, weight, knee_min
):
    joints = [
        rig.pose.bones[name + "_" + side] for name in ("thigh", "calf", "foot", "ball")
    ]
    upper, lower, foot, toe = joints
    a, b, c = [original[j.name][0] for j in joints[:3]]
    length1, length2 = (b - a).length, (c - b).length
    target = rig.matrix_world.inverted() @ target
    ray = (target - a).normalized()
    reach = max(
        abs(length1 - length2) + 0.0002,
        min((target - a).length, length1 + length2 - 0.0002),
    )
    along = (length1**2 - length2**2 + reach**2) / (2 * reach)
    center = a + ray * along
    radius = math.sqrt(max(0, length1**2 - along**2))
    pole = (knee_direction - ray * knee_direction.dot(ray)).normalized()
    vertical = UP - ray * ray.z
    min_z = knee_min - rig.matrix_world.translation.z
    if (
        radius > 0.0001
        and vertical.length > 0.0001
        and (center + pole * radius).z < min_z
    ):
        rise = max(-1, min(1, (min_z - center.z) / (radius * vertical.length)))
        side_axis = ray.cross(vertical.normalized())
        if side_axis.x * (1 if side == "l" else -1) < 0:
            side_axis.negate()
        pole = vertical.normalized() * rise + side_axis * math.sqrt(
            max(0, 1 - rise * rise)
        )
    knee = center + pole * radius
    ankle = a + ray * reach
    quats = {}
    for j, new in ((upper, knee - a), (lower, ankle - knee)):
        # Derive twist from each segment's rest orientation after sagittal bending.
        # The motion capture's crouch splays the knees, which would twist this shoe fit.
        rest_dir = j.bone.tail_local - j.bone.head_local
        pitch = math.atan2(new.y, -new.z) - math.atan2(rest_dir.y, -rest_dir.z)
        sagittal = Quaternion((1, 0, 0), pitch)
        quats[j.name] = (
            (sagittal @ rest_dir).rotation_difference(new)
            @ sagittal
            @ j.bone.matrix_local.to_quaternion()
        )
    quats[foot.name] = foot_rotation @ foot.bone.matrix_local.to_quaternion()
    quats[toe.name] = foot_rotation @ toe.bone.matrix_local.to_quaternion()
    for joint in joints:
        parent = joint.parent
        parent_rotation = quats.get(parent.name, original[parent.name][1])
        rest = (
            parent.bone.matrix_local.to_quaternion().inverted()
            @ joint.bone.matrix_local.to_quaternion()
        )
        wanted = (parent_rotation @ rest).inverted() @ quats[joint.name]
        joint.rotation_quaternion = original[joint.name][2].slerp(wanted, weight)
    return joints


def fit_legs(scene, rig, action, start, stop, shoes, jeans):
    """Place the right sole first while the left knee/toe carries the rear load."""
    enter, finish = max(1, start - 8), min(stop, start + 82)
    pelvis_path(scene, rig, action, start, stop)
    scene.frame_set(start)
    rear = {s: rig.matrix_world @ rig.pose.bones["foot_" + s].head for s in "lr"}
    scene.frame_set(finish)
    fronts = {s: rig.matrix_world @ rig.pose.bones["foot_" + s].head for s in "lr"}
    shoe_masks = {s: region(shoes, {"foot_" + s, "ball_" + s}, 0.55) for s in "lr"}
    knees = {
        s: region(jeans, {"thigh_" + s, "calf_" + s}, 0.8)
        & np.array([0.36 < v.co.z < 0.66 for v in jeans.data.vertices])
        for s in "lr"
    }
    updates = {}
    planted_soles = {}
    for frame in range(enter, finish + 1):
        scene.frame_set(frame)
        original = {
            b.name: (
                b.head.copy(),
                b.matrix.to_quaternion(),
                b.rotation_quaternion.copy(),
            )
            for b in rig.pose.bones
        }
        dt = frame - start
        weight = smooth((frame - enter) / 8)
        if finish < scene.frame_end:
            weight *= smooth((finish - frame) / 8)
        for s in "rl":
            sign = 1 if s == "l" else -1
            begin, end = (25, 40) if s == "r" else (43, 58)
            step = smooth((dt - begin) / (end - begin))
            pitch = math.radians(144 - 144 * step)
            yaw = math.radians(sign * (8 + 5 * step))
            rotation = Quaternion((0, 0, 1), yaw) @ Quaternion((1, 0, 0), pitch)
            goal = rear[s].lerp(fronts[s], step)
            arc = math.sin(math.pi * step)
            goal.x += sign * 0.036 * arc
            goal.z = 0.145 * (1 - step) + 0.082 * step + 0.105 * arc
            floor = 0.0015 + 0.105 * arc
            kneel = smooth((dt - 23) / 20)
            pole = Vector(
                (
                    sign * (0.12 + 0.20 * kneel + 0.12 * arc),
                    -0.36 * kneel - step,
                    -1 + step,
                )
            )
            knee_z = 0.073
            for _ in range(5):
                joints = leg_pose(
                    rig, s, original, goal, pole, rotation, weight, knee_z
                )
                bpy.context.view_layer.update()
                surface = positions(shoes)
                low = float(surface[shoe_masks[s], 2].min())
                knee_low = float(positions(jeans)[knees[s], 2].min())
                z_error = floor - low
                if weight < 0.999:
                    break
                knee_error = max(0, 0.001 - knee_low)
                # The shoe includes elastic upper weights reaching into the shin.
                # Lock the same load-bearing sole vertices through the knee extension.
                drift = np.zeros(2)
                if s in planted_soles:
                    patch, anchor = planted_soles[s]
                    drift = anchor - surface[patch, :2].mean(axis=0)
                if max(abs(z_error), knee_error, np.linalg.norm(drift)) < 0.00035:
                    break
                goal.x += drift[0]
                goal.y += drift[1]
                goal.z += z_error
                knee_z += knee_error
            if dt == end:
                patch = shoe_masks[s] & (surface[:, 2] <= low + 0.004)
                planted_soles[s] = patch, surface[patch, :2].mean(axis=0)
            for j in joints:
                q = j.rotation_quaternion.copy()
                values = updates.setdefault(j.name, {})
                q.make_compatible(values.get(frame - 1, original[j.name][2]))
                values[frame] = q
    write_curves(action, rig, updates)
