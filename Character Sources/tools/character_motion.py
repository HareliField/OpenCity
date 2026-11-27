"""Attach each resident's characteristic listening gesture to their poseable rig."""

import math
import random
import bpy


def listening_gesture(person):
    words = person["appearance"].lower()
    r = random.Random("gesture" + person["residentId"])
    peak = r.randint(24, 44)
    end = peak + r.randint(24, 42)
    joint, axis, angle = "head", 2, r.uniform(-4.2, 4.2)
    if "tilt" in words:
        joint, axis, angle = "head", 1, -7
    elif "nod" in words:
        joint, axis, angle = "head", 0, 6.5
    elif "shoulder" in words:
        joint, axis, angle = "spine_03", 1, 3.8
    elif "sleeve" in words:
        joint, axis, angle = "lowerarm_l", 2, 4.5
    elif "finger" in words:
        joint, axis, angle = "index_02_r", 0, -21
    elif "lift a hand" in words:
        joint, axis, angle = "lowerarm_r", 0, -9
    return joint, axis, angle, peak, end


def listening(rig, person):
    joint, axis, angle, peak, end = listening_gesture(person)
    bone = rig.pose.bones.get(joint)
    if not bone:
        return
    bone.rotation_mode = "XYZ"
    for frame, value in [(1, 0), (peak, math.radians(angle)), (end, 0)]:
        bone.rotation_euler[axis] = value
        bone.keyframe_insert(data_path="rotation_euler", index=axis, frame=frame)
    action = rig.animation_data.action
    action.name = person["name"] + " listening"
    action["residentId"] = person["residentId"]
    action["direction"] = person["appearance"]
    bpy.context.scene.frame_end = end
    bpy.context.scene.frame_set(1)


def reference_stance(rig, measurement):
    from mathutils import Matrix, Vector

    anchors = measurement.get("bodyAnchors", {})
    w, h = measurement["sourcePixels"]
    for side, points in [("l", (11, 13, 15)), ("r", (12, 14, 16))]:
        for name, i, j in [
            ("upperarm", points[0], points[1]),
            ("lowerarm", points[1], points[2]),
        ]:
            a = anchors.get(str(i))
            b = anchors.get(str(j))
            if a is None or b is None:
                continue
            pb = rig.pose.bones.get(name + "_" + side)
            if not pb:
                continue
            old = pb.tail - pb.head
            plane = Vector(((b[0] - a[0]) * w / h, 0, a[1] - b[1]))
            if plane.length < 0.028:
                continue
            plane.normalize()
            depth = max(-0.4, min(0.4, old.normalized().y))
            goal = Vector(
                (
                    plane.x * math.sqrt(1 - depth * depth),
                    depth,
                    plane.z * math.sqrt(1 - depth * depth),
                )
            )
            pivot = Matrix.Translation(pb.head)
            turn = old.normalized().rotation_difference(goal).to_matrix().to_4x4()
            pb.matrix = pivot @ turn @ pivot.inverted() @ pb.matrix
            bpy.context.view_layer.update()
