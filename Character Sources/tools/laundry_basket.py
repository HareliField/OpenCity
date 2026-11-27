"""Fit an open wire laundry basket to both hands during the Wash House work take."""

import math
import bpy


def add_basket(scene, rig, frame_start, frames):
    positions, yaw = [], []
    for frame in range(frame_start, frame_start + frames):
        scene.frame_set(frame)
        hands = [
            rig.matrix_world @ rig.pose.bones["middle_01_" + s].head for s in ("l", "r")
        ]
        positions.append((hands[0] + hands[1]) * 0.5)
        axis = hands[0] - hands[1]
        yaw.append(math.atan2(axis.y, axis.x))
    grip = min(range(frames), key=lambda i: positions[i].z)
    scene.frame_set(frame_start + grip)
    span = sum(
        (
            rig.matrix_world @ rig.pose.bones["middle_01_" + s].head - positions[grip]
        ).length
        for s in ("l", "r")
    )
    width, depth, height = span * 0.5, span * 0.33, positions[grip].z - 0.012
    curve = bpy.data.curves.new("Laundry basket wirework", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.0035
    curve.bevel_resolution = 1
    basket = bpy.data.objects.new("Wash House laundry basket", curve)
    scene.collection.objects.link(basket)
    mat = bpy.data.materials.new("Sea green coated wire")
    mat.diffuse_color = (0.034, 0.17, 0.15, 1)
    curve.materials.append(mat)

    def outline(a, t):
        x = math.cos(a)
        y = math.sin(a)
        return (
            width * math.copysign(abs(x) ** 0.58, x) * (0.77 + 0.23 * t),
            depth * math.copysign(abs(y) ** 0.58, y) * (0.78 + 0.22 * t),
            -height * (1 - t),
        )

    def wire(points, cycle=False, thickness=1):
        s = curve.splines.new("POLY")
        s.points.add(len(points) - 1)
        for p, v in zip(s.points, points):
            p.co = (*v, 1)
            p.radius = thickness
        s.use_cyclic_u = cycle

    for t in (0, 0.18, 0.37, 0.56, 0.76, 1):
        wire(
            [outline(i * math.tau / 80, t) for i in range(80)],
            True,
            1.65 if t == 1 else 1,
        )
    for i in range(40):
        a = i * math.tau / 40
        wire([outline(a, 0), outline(a, 1)])
    for i in range(11):
        a = (i + 0.5) * math.pi / 11
        wire([outline(a, 0), outline(-a, 0)])
    for i, position in enumerate(positions):
        j = max(grip, i)
        basket.location = positions[j]
        basket.rotation_euler.z = yaw[j]
        basket.keyframe_insert(data_path="location", frame=frame_start + i)
        basket.keyframe_insert(data_path="rotation_euler", frame=frame_start + i)
    basket["gripFrame"] = frame_start + grip
    scene.frame_set(frame_start)
