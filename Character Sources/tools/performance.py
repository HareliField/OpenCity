"""Build one resident's acting scene from measured movement and biographical direction."""

import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Quaternion

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resident_motion import (
    ROOT,
    activate,
    ground_action,
    captured,
    portion,
    sequence,
    write_action,
)


def key_shape(obj, name, values):
    if not obj or not obj.data.shape_keys or name not in obj.data.shape_keys.key_blocks:
        return
    key = obj.data.shape_keys.key_blocks[name]
    key.id_data.animation_data_clear()
    for frame, value in enumerate(values, 1):
        key.value = float(value)
        key.keyframe_insert(data_path="value", frame=frame)


def secondary(scene, track, pause):
    n = len(track["location"])
    frames = np.arange(n)
    sway = np.gradient(track["location"][:, 0]) * 19
    bob = np.gradient(track["location"][:, 2]) * 19
    for name in ("Folded windbreaker hood", "Cloth_jacket"):
        obj = scene.objects.get(name)
        if not obj:
            continue
        if not obj.data.shape_keys:
            obj.shape_key_add(name="Rest cut")
        if "Cloth settling" not in obj.data.shape_keys.key_blocks:
            key = obj.shape_key_add(name="Cloth settling")
            zs = [v.co.z for v in key.data]
            low, height = min(zs), max(zs) - min(zs)
            for v in key.data:
                weight = max(0, 1 - (v.co.z - low) / (0.63 * height)) ** 2
                if name == "Cloth_jacket":
                    weight *= max(0, 1 - abs(v.co.x) / 0.28)
                v.co.y += 0.008 * weight
                v.co.z += 0.003 * weight * math.cos(v.co.x * 52)
            key.slider_min = -1
        key_shape(
            obj,
            "Cloth settling",
            np.convolve(bob, [0, 0.1, 0.3, 0.4, 0.2], mode="full")[:n].clip(-1, 1),
        )
    key_shape(
        scene.objects.get("Loose temple wisps"),
        "Delayed tips",
        np.convolve(sway, [0, 0, 0.2, 0.3, 0.3, 0.2], mode="full")[:n].clip(-1, 1),
    )
    key_shape(
        scene.objects.get("Measured face"),
        "Listening brow lift",
        np.interp(
            frames,
            [0, pause - 8, pause + 2, pause + 15, pause + 28, n - 1],
            [0, 0, 1, 0.91, 0, 0],
        ),
    )


def perform(folder):
    scene = bpy.context.scene
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    person = json.loads((folder / "persona.json").read_text())
    direction = json.loads((folder / "art-direction.json").read_text())["performance"]
    parts = [
        portion(captured(rig, key), start, stop, length)
        for key, start, stop, length in direction["cuts"]
    ]
    for beat in direction.get("plantedBeats", []):
        # Her feet remain where she stopped while her torso answers Rafael.
        for key, values in parts[beat].items():
            if key in ("location", "pelvis") or key.startswith(
                ("thigh_", "calf_", "foot_", "ball_")
            ):
                values[:] = parts[beat - 1][key][-1]
    for key, strength in direction.get("gestureWeights", {}).items():
        rest = Quaternion(parts[0][key][-1])
        parts[1][key] = np.asarray(
            [rest.slerp(Quaternion(q), strength) for q in parts[1][key]]
        )
    track = sequence(parts, overlap=8)
    track["location"][:, 1] += 0.77
    pause = direction["listenFrame"]
    # Set a relaxed finger curl, then open the hand as she gives the customer room.
    frames = np.arange(len(track["location"]))
    release = np.interp(
        frames,
        [0, pause, pause + 18, pause + 45, pause + 66, len(frames) - 1],
        [0, 0, 1, 1, 0, 0],
    )
    for side in ("l", "r"):
        for i, digit in enumerate(("index", "middle", "ring", "pinky")):
            for joint in ("01", "02"):
                k = f"{digit}_{joint}_{side}"
                track[k] = np.asarray(
                    [
                        Quaternion((1, 0, 0), math.radians((12 + i * 3) * (1 - t)))
                        for t in release
                    ]
                )
    name = person["name"] + " | " + direction["take"]
    previous = bpy.data.actions.get(name)
    if previous and previous.get("residentId") == person["residentId"]:
        bpy.data.actions.remove(previous)
    action = write_action(rig, name, track)
    action["circumstance"] = direction["trigger"]
    action["residentId"] = person["residentId"]
    activate(rig, action)
    ground_action(scene, rig, action)
    from resident_motion import pin_support

    pin_support(scene, rig, action)
    secondary(scene, track, pause)
    scene.timeline_markers.clear()
    for frame, label in direction["markers"]:
        scene.timeline_markers.new(label, frame=frame)
    scene.frame_set(1)
    rig["performanceBindings"] = json.dumps(
        [
            {"situation": r["situation"], "response": r["response"], "motion": motion}
            for r, motion in zip(
                person["reactions"], [action.name, "City | explain", "City | point"]
            )
        ],
        ensure_ascii=False,
    )
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(folder / "character.blend"), compress=True)


if __name__ == "__main__":
    folder = ROOT / "Residents" / sys.argv[sys.argv.index("--") + 1]
    bpy.ops.wm.open_mainfile(filepath=str(folder / "character.blend"), load_ui=False)
    perform(folder)
