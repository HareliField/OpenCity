"""Bake resident life events on the fitted skeleton, retaining injury state between events."""

import argparse
import json
import math
import numpy as np
from mathutils import Quaternion
import sys
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resident_motion import (
    ROOT,
    CATALOG,
    activate,
    ground_action,
    captured,
    portion,
    sequence,
    stage_action,
    write_action,
)

# Source frame spans start at zero. Ends are exclusive. All output is at 24 fps.
CUTS = {
    "wait": ("idle_shift", 12, 52, 40),
    "walk": ("walk_stop", 0, 57, 60),
    "hurt_walk": ("hurt_walk", 22, 95, 76),
    "run": ("start_run", 0, 43, 42),
    "sit": ("sit_rise", 12, 48, 40),
    "rise": ("sit_rise", 54, 75, 29),
    "talk": ("explain", 214, 282, 66),
    "greet": ("wave", 28, 91, 59),
    "lift_basket": ("lift_basket", 19, 47, 32),
    "clean_window": ("clean_window", 20, 90, 70),
    "dodge": ("dodge", 17, 85, 40),
    "stumble": ("stumble", 0, 48, 43),
    "get_up": ("get_up", 12, 106, 83),
    "turn": ("turn_walk", 0, 60, 60),
    "step_back": ("step_back", 12, 42, 35),
    "jump": ("jump", 0, 52, 52),
    "examine": ("look_around", 18, 90, 72),
}
INTERRUPTS = {"hurt", "knockdown", "dodge", "attack"}


def resolve(event, posture, injured):
    if posture == "down":
        if event == "recover":
            return "get_up", "standing", True
        if event in INTERRUPTS or event in ("wait", "walk", "run"):
            return "stay_down", "down", injured
        raise ValueError(f"The resident must recover before {event}")
    if event == "knockdown":
        return "fall", "down", True
    if event == "hurt":
        return "flinch", posture, True
    if event == "recover":
        return ("stay_seated" if posture == "seated" else "wait"), posture, False
    if event in ("walk", "run") and injured:
        return "hurt_walk", "standing", True
    if event == "sit":
        return "sit", "seated", injured
    if event == "rise":
        return ("rise" if posture == "seated" else "wait"), "standing", injured
    if posture == "seated" and event not in INTERRUPTS:
        if event == "wait":
            return "stay_seated", "seated", injured
        raise ValueError(f"The resident must rise before {event}")
    if event not in CUTS and event not in CATALOG and event != "attack":
        raise ValueError(f"Unknown event {event}")
    return event, "standing", injured


def footage(rig, key):
    if key in ("attack", "flinch"):
        return stage_action(rig, key)
    if key == "fall":
        down = portion(captured(rig, "get_up"), 14, 100, 37)
        return {k: v[::-1].copy() for k, v in down.items()}
    if key == "stay_down":
        return portion(captured(rig, "get_up"), 5, 24, 28)
    if key == "stay_seated":
        return portion(captured(rig, "sit_rise"), 42, 55, 24)
    if key not in CUTS:
        return captured(rig, key)
    clip, begin, end, count = CUTS[key]
    source = captured(rig, clip)
    return portion(source, begin, min(len(source["location"]), end), count)


def personal_gesture(track, person):
    from character_motion import listening_gesture

    joint, axis, angle, peak, end = listening_gesture(person)
    n = len(track["location"])
    keys = track.get(joint, np.tile([1, 0, 0, 0], (n, 1)))
    beat = np.interp(
        np.linspace(0, end, n), [0, peak, end], [0, math.radians(angle), 0]
    )
    vector = np.eye(3)[axis]
    track[joint] = np.asarray(
        [Quaternion(q) @ Quaternion(vector, t) for q, t in zip(keys, beat)]
    )


def bake(rig, events, continue_take=False):
    posture = rig.get("posture", "standing")
    injured = bool(rig.get("injured", False))
    person = json.loads(bpy.data.texts[rig["personaText"]].as_string())
    parts, beats = [], []
    end = 0
    for event in events:
        key, posture, injured = resolve(event, posture, injured)
        part = footage(rig, key)
        if key in ("wait", "talk", "greet", "stay_seated"):
            personal_gesture(part, person)
        frame = max(1, end - 5 + 1)
        end = frame + len(part["location"]) - 1
        parts.append(part)
        beats.append(
            dict(event=event, motion=key, frame=frame, posture=posture, injured=injured)
        )
    # A finger gesture may occur only in one beat. Unaffected beats use rest.
    channels = set().union(*(part.keys() for part in parts))
    for part in parts:
        for k in channels - part.keys():
            part[k] = np.tile([1, 0, 0, 0], (len(part["location"]), 1))
    if continue_take:
        sc = bpy.context.scene
        sc.frame_set(sc.frame_end)
        previous = {
            k: np.tile(
                rig.location
                if k == "location"
                else rig.pose.bones[k].matrix_basis.to_quaternion(),
                (5, 1),
            )
            for k in channels
        }
        for prop in sc.objects:
            if "gripFrame" in prop and prop.animation_data:
                transform = prop.matrix_world.copy()
                prop.animation_data_clear()
                prop.matrix_world = transform
        parts.insert(0, previous)
    track = sequence(parts, overlap=5)
    action = write_action(rig, rig.name + " | " + ", ".join(events), track)
    for key_data in bpy.data.shape_keys:
        if key_data.library or not key_data.animation_data:
            continue
        # The hero's previous narrative facial expression belongs to that take.
        key_data.animation_data.action = None
        for key in key_data.key_blocks:
            if key.name in ("Cloth settling", "Listening brow lift", "Delayed tips"):
                key.value = 0
    activate(rig, action)
    rig["posture"], rig["injured"] = posture, injured
    action["events"] = json.dumps(beats)
    scene = bpy.context.scene
    if all(
        b["motion"] not in ("run", "start_run", "run_stop", "jump", "climb_ladder")
        for b in beats
    ):
        ground_action(
            scene,
            rig,
            action,
            include_body=any(
                b["motion"] in ("fall", "stay_down", "get_up") for b in beats
            ),
        )
    scene.timeline_markers.clear()
    for beat in beats:
        scene.timeline_markers.new(beat["event"], frame=beat["frame"])
    if events == ["lift_basket"]:
        from laundry_basket import add_basket

        add_basket(scene, rig, 1, scene.frame_end)
    return action


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("resident")
    p.add_argument("events", nargs="+")
    p.add_argument("--output", required=True, type=Path)
    p.add_argument(
        "--from-scene",
        type=Path,
        help="Continue from the final pose and state of a saved take",
    )
    args = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    folder = ROOT / "Residents" / args.resident
    source = args.from_scene or folder / "character.blend"
    if args.output.resolve() in (
        source.resolve(),
        (folder / "character.blend").resolve(),
    ):
        raise ValueError("Use a separate output file for the event take")
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    if rig.get("residentId") != args.resident:
        raise ValueError("The saved take belongs to a different resident")
    action = bake(rig, args.events, continue_take=bool(args.from_scene))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
    print(action["events"])
