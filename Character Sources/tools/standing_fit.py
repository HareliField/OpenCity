"""Measure a planted frontal pose in the original casting photograph's coordinates."""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from game_character import clips
from recovery_contact import activate_imported, positions
from resident_motion import ROOT, activate, write_action
from workday_performance import casting_targets, shoe_region

LABELS = {
    "elbow": "lowerarm",
    "wrist": "hand",
    "ankle": "foot",
    "middle": "middle_03",
    "thumb": "thumb_03",
}


def inspect(scene, rig, action, view, targets):
    anchor, scale_x, scale_y = view

    def project(point):
        return np.array(
            [anchor["centerX"] + point.x / scale_x, anchor["soleY"] - point.z / scale_y]
        )

    joints = {(part, side): [] for side in "lr" for part in LABELS}
    shoes = scene.objects["Cloth_shoes"]
    masks = {side: shoe_region(shoes, side) for side in "lr"}
    clearances = []
    nails = scene.objects.get("Short natural nails")
    body = scene.objects.get("Body")
    nail_groups = {}
    nail_distances = {}
    if nails and body:
        for v in nails.data.vertices:
            group = max(v.groups, key=lambda g: g.weight)
            digit, _, side = nails.vertex_groups[group.group].name.split("_")
            nail_groups.setdefault(digit + "_" + side, []).append(v.index)
    first, last = map(int, action.frame_range)
    for frame in range(first, last + 1):
        scene.frame_set(frame)
        xy = positions(shoes)
        clearances.append([xy[mask, 2].min() for mask in masks.values()])
        if nail_groups:
            surface = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
            body_space = body.matrix_world.inverted()
            nail_points = positions(nails)
            for digit, indices in nail_groups.items():
                height = max(
                    surface.find_nearest(body_space @ Vector(nail_points[i]))[3]
                    for i in indices
                )
                nail_distances[digit] = max(nail_distances.get(digit, 0.0), height)
        for (part, side), samples in joints.items():
            bone = rig.pose.bones[LABELS[part] + "_" + side]
            samples.append(
                project(
                    rig.matrix_world
                    @ (bone.tail if part in ("middle", "thumb") else bone.head)
                )
            )
    summary = {}
    for (part, side), points in joints.items():
        photo = project(targets[part + "_" + side])
        fitted = np.mean(points, axis=0)
        delta = np.asarray(points) - photo
        summary[part + "_" + side] = {
            "photoXY": np.round(photo, 5).tolist(),
            "meanModelXY": np.round(fitted, 5).tolist(),
            "offsetXY": np.round(fitted - photo, 5).tolist(),
            "maximumAbsoluteOffsetXY": np.round(np.abs(delta).max(axis=0), 5).tolist(),
        }
    width = np.array(joints["ankle", "l"])[:, 0] - np.array(joints["ankle", "r"])[:, 0]
    result = {
        "frames": last - first + 1,
        "anchors": summary,
        "photoAnkleSpacingInImageWidths": round(
            anchor["shoeCollars"]["l"][0] - anchor["shoeCollars"]["r"][0], 5
        ),
        "meanModelAnkleSpacingInImageWidths": round(float(width.mean()), 5),
        "maximumShoeClearanceMm": [
            round(float(v) * 1000, 2) for v in np.max(clearances, axis=0)
        ],
        "minimumShoeHeightMm": [
            round(float(v) * 1000, 2) for v in np.min(clearances, axis=0)
        ],
    }
    if nail_distances:
        result["maximumNailToSkinDistanceMm"] = {
            digit: round(1000 * gap, 3) for digit, gap in nail_distances.items()
        }
    return result


def capture(scene, rig, action, folder, view, output):
    from movement_review import setup

    frame, scale_x, scale_y = view
    setup(scene, folder)
    scene.frame_set(int(action.frame_range[0]))
    scene.render.resolution_x, scene.render.resolution_y = 400, 600
    scene.cycles.samples = 7
    center = Vector(
        ((0.5 - frame["centerX"]) * scale_x, 0.0, (frame["soleY"] - 0.5) * scale_y)
    )
    scene.camera.data.ortho_scale = scale_y
    scene.camera.location = center + Vector((0, -4, 0))
    scene.camera.rotation_euler = (
        (center - scene.camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    scene.render.filepath = str(output.resolve())
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("resident")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--render", type=Path)
    parser.add_argument("--game-model", type=Path)
    options = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    folder = ROOT / "Residents" / options.resident
    recipe = json.loads((folder / "game-actions.json").read_text())["Idle"]
    unfitted = {k: v for k, v in recipe.items() if k != "performance"}
    rig, tracks = clips(folder, {"Unfitted": unfitted, "Idle": recipe})
    scene = bpy.context.scene
    targets, view = casting_targets(folder, scene)
    fit = json.loads((folder / "photo-fit.json").read_text())
    report = {
        "residentId": options.resident,
        "photo": "reference.jpg",
        "coordinates": "Fractions of the full photo width and height, x right and y down. Bilateral landmarks use the resident’s anatomical left and right. Ankle heights use the visible shoe collars.",
        "imagePixels": fit["sourcePixels"],
        "referenceSha256": fit["referenceSha256"],
        "registration": {
            "centerX": view[0]["centerX"],
            "crownY": view[0]["crownY"],
            "soleY": view[0]["soleY"],
            "widthMeters": round(view[1], 5),
            "heightMeters": round(view[2], 5),
        },
    }
    for label, track in tracks.items():
        action = write_action(rig, label, track)
        activate(rig, action)
        report[label] = inspect(scene, rig, action, view, targets)
        if label == "Idle" and options.render:
            capture(scene, rig, action, folder, view, options.render)
    report["detectorAnkleOffsetsXY"] = {}
    for side, key in (("l", "27"), ("r", "28")):
        model = report["Idle"]["anchors"]["ankle_" + side]["meanModelXY"]
        report["detectorAnkleOffsetsXY"][side] = np.round(
            np.array(model) - fit["bodyAnchors"][key], 5
        ).tolist()
    if options.game_model:
        report["gameModelSha256"] = hashlib.sha256(
            options.game_model.read_bytes()
        ).hexdigest()
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        scene.render.fps = 24
        bpy.ops.import_scene.gltf(filepath=str(options.game_model.resolve()))
        rig = next(o for o in scene.objects if o.type == "ARMATURE")
        for track in rig.animation_data.nla_tracks:
            track.mute = True
        idle = bpy.data.actions["Idle"]
        activate_imported(rig, idle)
        report["gameIdle"] = inspect(scene, rig, idle, view, targets)
    options.report.write_text(json.dumps(report, indent=2) + "\n")
