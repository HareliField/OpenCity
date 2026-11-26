"""Fit the CMU prone recovery to the ground using Ida's deformed palms and knees."""

import bpy
import numpy as np
from mathutils import Matrix, Vector

DIGITS = ("index", "middle", "ring", "pinky", "thumb")
UP = Vector((0, 0, 1))


def smooth(value):
    t = min(1.0, max(0.0, value))
    return t * t * (3.0 - 2.0 * t)


def positions(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    co = np.empty(len(evaluated.data.vertices) * 3, dtype="f")
    evaluated.data.vertices.foreach_get("co", co)
    matrix = np.asarray(evaluated.matrix_world)
    return co.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]


def region(body, names, threshold):
    indices = {g.index for g in body.vertex_groups if g.name in names}
    return np.asarray(
        [
            sum(g.weight for g in v.groups if g.group in indices) > threshold
            for v in body.data.vertices
        ]
    )


def plane_orientation(forward, normal):
    forward = forward.normalized()
    across = forward.cross(normal).normalized()
    return Matrix((across, forward, across.cross(forward))).transposed().to_quaternion()


def hand_basis(rig, side, forward):
    bone = rig.data.bones
    hand = bone["hand_" + side]
    direction = bone["middle_01_" + side].head_local - hand.head_local
    lateral = bone["pinky_01_" + side].head_local - bone["index_01_" + side].head_local
    dorsum = direction.cross(lateral) * (1 if side == "l" else -1)
    source = plane_orientation(direction, dorsum)
    # The hypothenar pad and heel sit deeper than the thumb in this anatomical mesh.
    across = forward.cross(UP).normalized()
    pitch = -0.04
    roll = 0.13 if side == "l" else -0.13
    return (
        plane_orientation(forward + UP * pitch, UP - across * roll - forward * pitch)
        @ source.inverted()
        @ hand.matrix_local.to_quaternion()
    )


def arm_pose(rig, side, target, hand_rotation, amount, finger_pressure, original):
    bones = rig.pose.bones
    upper, forearm, hand = [
        bones[k + "_" + side] for k in ("upperarm", "lowerarm", "hand")
    ]
    world = rig.matrix_world
    target = world.inverted() @ target
    a, b, c = [original[k.name][0] for k in (upper, forearm, hand)]
    ray = (target - a).normalized()
    l1, l2 = (b - a).length, (c - b).length
    reach = min(max((target - a).length, abs(l1 - l2) + 0.001), l1 + l2 - 0.0001)
    along = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach)
    # Retain the captured side of the elbow bend as the shoulder rises.
    pole = ((b - a) - ray * (b - a).dot(ray)).normalized()
    center = a + ray * along
    radius = max(0, l1 * l1 - along * along) ** 0.5
    lift = UP - ray * ray.z
    lowest_elbow = world.inverted() @ Vector((target.x, target.y, 0.055))
    if (
        radius > 0.001
        and lift.length > 0.001
        and (center + pole * radius).z < lowest_elbow.z
    ):
        # Rotate the elbow around the shoulder-to-wrist line so the sleeve clears the floor.
        slope = min(1, max(-1, (lowest_elbow.z - center.z) / (radius * lift.length)))
        normal = lift.normalized()
        sideways = ray.cross(normal)
        if sideways.dot(pole) < 0:
            sideways.negate()
        pole = normal * slope + sideways * max(0, 1 - slope * slope) ** 0.5
    elbow = center + pole * radius
    end = a + ray * reach
    rotations = {}
    for pb, before, after in ((upper, b - a, elbow - a), (forearm, c - b, end - elbow)):
        rotations[pb.name] = before.rotation_difference(after) @ original[pb.name][1]
    rotations[hand.name] = world.to_quaternion().inverted() @ hand_rotation
    # Keep the pad of each phalanx on the plane instead of balancing on the fingertips.
    for digit in DIGITS:
        parent = hand
        for segment in ("01", "02", "03"):
            pb = bones[digit + "_" + segment + "_" + side]
            relation = (
                parent.bone.matrix_local.to_quaternion().inverted()
                @ pb.bone.matrix_local.to_quaternion()
            )
            inherited = rotations[parent.name] @ relation
            direction = inherited @ Vector((0, 1, 0))
            flat = Vector(
                (direction.x, direction.y, -0.025 if segment == "01" else 0.012)
            ).normalized()
            pressed = direction.rotation_difference(flat) @ inherited
            relaxed = inherited @ original[pb.name][2]
            rotations[pb.name] = relaxed.slerp(pressed, finger_pressure)
            parent = pb
    for name, q in rotations.items():
        pb = bones[name]
        relation = (
            pb.parent.bone.matrix_local.to_quaternion().inverted()
            @ pb.bone.matrix_local.to_quaternion()
        )
        parent = rotations.get(pb.parent.name, original[pb.parent.name][1])
        wanted = (parent @ relation).inverted() @ q
        pb.rotation_quaternion = original[name][2].slerp(wanted, amount)
    return list(rotations)


def write_curves(action, rig, updates):
    bag = action.layers[0].strips[0].channelbag(action.slots[0])
    for name, data in updates.items():
        pb = rig.pose.bones[name]
        path = pb.path_from_id("rotation_quaternion")
        for axis in range(4):
            curve = bag.fcurves.find(path, index=axis)
            if not curve:
                curve = bag.fcurves.new(path, index=axis)
            existing = {int(pt.co.x): pt for pt in curve.keyframe_points}
            for frame, value in data.items():
                if frame in existing:
                    existing[frame].co.y = value[axis]
                else:
                    pt = curve.keyframe_points.insert(
                        frame, value[axis], options={"FAST"}
                    )
                    pt.interpolation = "LINEAR"
            curve.update()


def support_fabric(scene, garments):
    """Compress the loose cuff against the studio floor after skeletal deformation."""
    if not garments:
        return
    plane = scene.objects.get("Recovery floor plane")
    if plane is None:
        plane = bpy.data.objects.new("Recovery floor plane", None)
        scene.collection.objects.link(plane)
        plane.empty_display_size = 0.1
        plane.hide_render = True
    for garment in garments:
        if garment.modifiers.get("Cuff floor contact"):
            continue
        nodes = bpy.data.node_groups.new(
            garment.name + " ground contact", "GeometryNodeTree"
        )
        for direction in ("INPUT", "OUTPUT"):
            nodes.interface.new_socket(
                name="Geometry", in_out=direction, socket_type="NodeSocketGeometry"
            )
        source = nodes.nodes.new("NodeGroupInput")
        result = nodes.nodes.new("NodeGroupOutput")
        surface = nodes.nodes.new("GeometryNodeSetPosition")
        point = nodes.nodes.new("GeometryNodeInputPosition")
        floor = nodes.nodes.new("GeometryNodeObjectInfo")
        floor.transform_space = "RELATIVE"
        floor.inputs["Object"].default_value = plane
        local_z = nodes.nodes.new("ShaderNodeSeparateXYZ")
        ground_z = nodes.nodes.new("ShaderNodeSeparateXYZ")
        nodes.links.new(point.outputs[0], local_z.inputs[0])
        nodes.links.new(floor.outputs["Location"], ground_z.inputs[0])
        gap = nodes.nodes.new("ShaderNodeMath")
        gap.operation = "SUBTRACT"
        nodes.links.new(ground_z.outputs["Z"], gap.inputs[0])
        nodes.links.new(local_z.outputs["Z"], gap.inputs[1])
        lift = nodes.nodes.new("ShaderNodeMath")
        lift.operation = "MAXIMUM"
        lift.inputs[1].default_value = 0
        nodes.links.new(gap.outputs[0], lift.inputs[0])
        offset = nodes.nodes.new("ShaderNodeCombineXYZ")
        nodes.links.new(lift.outputs[0], offset.inputs["Z"])
        nodes.links.new(source.outputs[0], surface.inputs["Geometry"])
        nodes.links.new(offset.outputs[0], surface.inputs["Offset"])
        nodes.links.new(surface.outputs[0], result.inputs[0])
        garment.modifiers.new("Cuff floor contact", "NODES").node_group = nodes


def fit_recovery(scene, rig, action, start, stop):
    """The frame offsets follow the retimed get_up cut in play_event.CUTS."""
    body = scene.objects["Body"]
    shoes = next(o for o in scene.objects if o.name in ("Cloth_shoes", "Cloth_boots"))
    bottoms = next(
        (
            o
            for o in scene.objects
            if o.name in ("Cloth_jeans", "Cloth_skirt", "Cloth_shorts")
        ),
        None,
    )
    trunk = region(
        body,
        {
            "pelvis",
            "spine_01",
            "spine_02",
            "spine_03",
            "head",
            "neck_01",
            "thigh_l",
            "thigh_r",
            "calf_l",
            "calf_r",
        },
        0.68,
    )
    tops = [
        o
        for o in scene.objects
        if o.name in ("Cloth_jacket", "Cloth_tshirt", "Cloth_hoodie", "Cloth_dress")
    ]
    garment_trunks = [
        (o, region(o, {"pelvis", "spine_01", "spine_02", "spine_03", "neck_01"}, 0.60))
        for o in tops
    ]
    hands = {
        s: region(
            body,
            {"hand_" + s}
            | {d + "_" + n + "_" + s for d in DIGITS for n in ("01", "02", "03")},
            0.55,
        )
        for s in ("l", "r")
    }
    enter = max(1, start - 4)
    leave = min(stop, start + 60)
    bag = action.layers[0].strips[0].channelbag(action.slots[0])
    z_curve = bag.fcurves.find("location", index=2)
    # The lower body must support the actor while the arms reach, press and release.
    for f in range(enter, leave + 1):
        scene.frame_set(f)
        surfaces = [positions(shoes)[:, 2].min(), positions(body)[trunk, 2].min()]
        surfaces.extend(
            positions(obj)[mask, 2].min() for obj, mask in garment_trunks if mask.any()
        )
        if bottoms:
            surfaces.append(positions(bottoms)[:, 2].min())
        weight = smooth((f - enter) / 5) * smooth((leave - f) / 6)
        z_curve.keyframe_points[f - 1].co.y -= min(surfaces) * weight
    z_curve.update()
    # Measure the original wrist placements from the approach and the ensuing press.
    anchors = {}
    for frame, label in [(start + 8, "rest"), (start + 24, "press")]:
        scene.frame_set(min(stop, frame))
        for side in ("l", "r"):
            hand = rig.pose.bones["hand_" + side]
            p = rig.matrix_world @ hand.head
            p.z = 0.025
            anchors[side, label] = p
    scene.frame_set(min(stop, start + 24))
    across = rig.pose.bones["upperarm_l"].head - rig.pose.bones["upperarm_r"].head
    forward = Vector((across.y, -across.x, 0)).normalized()
    ups = {
        side: hand_basis(
            rig,
            side,
            (
                forward
                + Vector((across.x, across.y, 0)).normalized()
                * (0.14 if side == "l" else -0.14)
            ).normalized(),
        )
        for side in ("l", "r")
    }
    updates = {}
    for frame in range(enter, leave + 1):
        scene.frame_set(frame)
        original = {
            b.name: (
                b.head.copy(),
                b.matrix.to_quaternion(),
                b.rotation_quaternion.copy(),
            )
            for b in rig.pose.bones
        }
        baseline_skin = positions(body)
        dt = frame - start
        for side in ("l", "r"):
            original_wrist = rig.matrix_world @ original["hand_" + side][0]
            release = 35 if side == "l" else 38
            blend = smooth((frame - enter) / 5)
            # Move from the prone placement onto the support pads underneath the shoulders.
            reposition = smooth((dt - 10) / 10)
            arc = 0.028 * np.sin(reposition * np.pi)
            goal = anchors[side, "rest"].lerp(anchors[side, "press"], reposition)
            goal.z += arc
            desired_floor = 0.001 + arc
            # After the weight transfer, let the hand swing free with a flexed wrist.
            rotation = ups[side]
            carry = 0.0
            if dt > release:
                carry = smooth((dt - release) / 9)
                low = float(baseline_skin[hands[side], 2].min())
                released = original_wrist + UP * max(0, 0.055 - low)
                goal = goal.lerp(released, carry)
                rotation = rotation.slerp(
                    rig.matrix_world.to_quaternion() @ original["hand_" + side][1],
                    carry,
                )
                desired_floor = (1 - carry) * 0.001 + carry * max(low, 0.055)
                if dt >= release + 9 and low > 0.055:
                    blend = 0.0

            names = arm_pose(rig, side, goal, rotation, blend, 1 - carry, original)
            for attempt in range(3):
                bpy.context.view_layer.update()
                v = positions(body)
                low = v[hands[side], 2].min()
                err = desired_floor - low
                if blend < 0.999:
                    # Once released, only lift a hand that would cross the floor.
                    err = max(0, -low + 0.001)
                if abs(err) < 0.0006:
                    break
                goal.z += err / max(blend, 0.03)
                if blend > 0.003:
                    arm_pose(rig, side, goal, rotation, blend, 1 - carry, original)
            for name in names:
                q = rig.pose.bones[name].rotation_quaternion.copy()
                values = updates.setdefault(name, {})
                previous = values.get(frame - 1, original[name][2])
                q.make_compatible(previous)
                values[frame] = q
    write_curves(action, rig, updates)
    support_fabric(scene, tops)
    return [(start + 21, min(stop, start + 32), s) for s in ("l", "r")]


def audit(scene, windows):
    body = scene.objects["Body"]
    results = []
    for first, last, side in windows:
        palm = region(body, {"hand_" + side}, 0.78)
        hand = region(
            body,
            {"hand_" + side}
            | {d + "_" + n + "_" + side for d in DIGITS for n in ("01", "02", "03")},
            0.55,
        )
        pads = []
        all_skin = []
        points = []
        for f in range(first, last + 1):
            scene.frame_set(f)
            xyz = positions(body)
            pads.append(float(xyz[palm, 2].min()))
            all_skin.append(float(xyz[hand, 2].min()))
            points.append(np.mean(xyz[palm, :2], axis=0))
        if pads:
            results.append(
                dict(
                    side=side,
                    firstFrame=first,
                    lastFrame=last,
                    maximumPalmClearanceMm=round(max(pads) * 1000, 2),
                    deepestHandPenetrationMm=round(max(0, -min(all_skin)) * 1000, 2),
                    palmHorizontalTravelMm=round(
                        float(max(np.linalg.norm(p - points[0]) for p in points))
                        * 1000,
                        2,
                    ),
                )
            )
    return results


if __name__ == "__main__":
    import argparse
    import json
    import sys
    from pathlib import Path

    parser = argparse.ArgumentParser(
        description="Reopen a recovery take and measure the posed palm surfaces."
    )
    parser.add_argument("take", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument(
        "--game-model",
        type=Path,
        help="Also measure the Recover action imported from the game GLB",
    )
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    bpy.ops.wm.open_mainfile(filepath=str(args.take.resolve()), load_ui=False)
    scene = bpy.context.scene
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    action = rig.animation_data.action
    windows = [
        (v["firstFrame"], v["lastFrame"], v["side"])
        for v in json.loads(action["palmContact"])
    ]
    result = {
        "residentId": rig["residentId"],
        "action": action.name,
        "fps": scene.render.fps,
        "contacts": audit(scene, windows),
    }
    if args.game_model:
        start = scene.timeline_markers["recover"].frame
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        scene.render.fps = result["fps"]
        bpy.ops.import_scene.gltf(filepath=str(args.game_model.resolve()))
        rig = next(o for o in scene.objects if o.type == "ARMATURE")
        action = bpy.data.actions["Recover"]
        for track in rig.animation_data.nla_tracks:
            track.mute = True
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots[0]
        shift = int(action.frame_range[0]) - start
        result["gameContacts"] = audit(
            scene, [(f + shift, l + shift, s) for f, l, s in windows]
        )
    report = json.dumps(result, indent=2) + "\n"
    if args.report:
        args.report.write_text(report)
    print(report)
