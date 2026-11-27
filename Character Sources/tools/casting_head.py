"""Fit the entire head and its rotation pivot in the registered full-length photograph."""

import json

import bpy
import numpy as np
from mathutils import Matrix


def fit(rig, folder):
    direction = folder / "art-direction.json"
    if not direction.is_file():
        return
    view = json.loads(direction.read_text()).get("performance", {}).get("castingView")
    scene = bpy.context.scene
    face = scene.objects.get("Measured face")
    if not view or face is None:
        return
    photo = json.loads((folder / "photo-fit.json").read_text())
    state = rig.data.pose_position
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()
    from workday_performance import body, casting_targets

    _, (_, photo_width, photo_height) = casting_targets(folder, scene)

    center = np.mean(
        [face.matrix_world @ face.data.vertices[i].co for i in (33, 263)], axis=0
    )
    rest_world = rig.matrix_world.copy()
    original_location = rig.location.copy()
    original_basis = {b.name: b.matrix_basis.copy() for b in rig.pose.bones}
    original_action = rig.animation_data.action if rig.animation_data else None
    rig.data.pose_position = "POSE"
    if rig.animation_data:
        rig.animation_data.action = None
    # The head follows the torso. Evaluating the torso at one Idle beat is
    # sufficient here; a full limb and fingertip solve belongs to the motion bake.
    recipe = json.loads((folder / "game-actions.json").read_text())["Idle"]
    start, end = recipe["frames"]
    body(rig, 12 / max(1, end - start - 1), False)
    bpy.context.view_layer.update()
    marks = [33, 263, 152]
    xyz = np.array([face.matrix_world @ face.data.vertices[i].co for i in marks])
    uvs = np.array([photo["faceAnchors"][str(i)] for i in marks])
    mid = xyz[:2].mean(0)
    u, v = uvs[:2].mean(0)
    goal = np.array(
        [
            (u - view["centerX"]) * photo_width,
            mid[1],
            (view["soleY"] - v) * photo_height,
        ]
    )
    lateral = photo_width * (uvs[1, 0] - uvs[0, 0]) / (xyz[1, 0] - xyz[0, 0])
    vertical = photo_height * (uvs[2, 1] - v) / (mid[2] - xyz[2, 2])
    scale = np.array([lateral, lateral, vertical])
    if not np.all((scale > 0.78) & (scale < 1.32)):
        raise ValueError(f"Unexpected casting head scale {scale}")
    transform = np.eye(4)
    transform[:3, :3] = np.diag(scale)
    transform[:3, 3] = goal - scale * mid
    bone = rig.pose.bones["head"]
    posed = (
        rig.matrix_world
        @ bone.matrix
        @ bone.bone.matrix_local.inverted()
        @ rest_world.inverted()
    )
    affine = posed.inverted() @ Matrix(transform.tolist()) @ posed
    if rig.animation_data:
        rig.animation_data.action = original_action
    rig.location = original_location
    for bone in rig.pose.bones:
        bone.matrix_basis = original_basis[bone.name]
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()

    anchored = {
        obj: affine @ obj.matrix_world
        for obj in scene.objects
        if obj.parent == rig and obj.parent_type == "BONE" and obj.parent_bone == "head"
    }
    captured_head = [
        o
        for o in scene.objects
        if o.name.startswith(
            (
                "Captured jaw",
                "Captured head",
                "Photographed neckline",
                "Scalp beneath the groom",
            )
        )
    ]
    anatomy = [
        scene.objects.get(n)
        for n in ("Body", "Eyes", "Eyebrows", "Eyelashes", "Teeth", "Tongue")
    ]
    for obj in [*anatomy, *captured_head]:
        if obj is None or obj in anchored or obj.type != "MESH":
            continue
        # Measure the morphed resident in rest space, keeping one sample per original
        # vertex. The coverage mask and viewport subdivision would change the topology.
        topology = [
            m
            for m in obj.modifiers
            if m.show_viewport and m.type in ("MASK", "SUBSURF")
        ]
        for mod in topology:
            mod.show_viewport = False
        bpy.context.view_layer.update()
        deps = bpy.context.evaluated_depsgraph_get()
        live = obj.evaluated_get(deps).data
        if len(live.vertices) != len(obj.data.vertices):
            raise ValueError(f"Changed anatomical topology on {obj.name}")
        xyz = np.empty((len(live.vertices), 3), dtype="f")
        live.vertices.foreach_get("co", xyz.ravel())
        world = np.asarray(obj.matrix_world)
        points = xyz @ world[:3, :3].T + world[:3, 3]
        for mod in topology:
            mod.show_viewport = True
        weight = np.clip((points[:, 2] - center[2] + 0.225) / 0.11, 0, 1)
        weight = weight * weight * (3 - 2 * weight)
        matrix = np.asarray(affine)
        delta = (points @ matrix[:3, :3].T + matrix[:3, 3] - points) * weight[:, None]
        delta = delta @ np.linalg.inv(world[:3, :3]).T
        obj.data = obj.data.copy()
        arrays = [obj.data.vertices]
        if obj.data.shape_keys:
            arrays.extend(k.data for k in obj.data.shape_keys.key_blocks)
        for array in arrays:
            coords = np.empty_like(xyz)
            array.foreach_get("co", coords.ravel())
            array.foreach_set("co", (coords + delta).astype("f").ravel())
        obj.data.update()

    # Move the head pivot with the fitted skull. This preserves the centre of
    # rotation for looking and the neck endpoint used by gameplay collision.
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    head = rig.data.edit_bones["head"]
    neck = rig.data.edit_bones["neck_01"]
    local = rig.matrix_world.inverted() @ affine @ rig.matrix_world
    joint = head.head.copy()
    end = head.tail.copy()
    neck.tail += local @ joint - joint
    head.head = local @ joint
    head.tail = local @ end
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    for obj, matrix in anchored.items():
        obj.matrix_world = matrix
    rig.data.pose_position = state
    bpy.context.view_layer.update()
    print(
        "Casting head scale",
        scale.round(4),
        "eye correction mm",
        ((goal - mid) * 1000).round(1),
    )
