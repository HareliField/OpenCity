"""Render a fixed-camera movement review and measure the shoe contact against the floor."""

import argparse, json, os, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))


def setup(scene, folder):
    camera = scene.camera
    if not camera:
        raise ValueError("Build the studio scene before rendering motion")
    camera.location = (-2.3, -4.25, 1.42)
    camera.rotation_euler = (
        (Vector((-0.07, -0.18, 0.94)) - camera.location)
        .to_track_quat("-Z", "Y")
        .to_euler()
    )
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.92
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.003))
    floor = bpy.context.object
    floor.name = "Movement review floor"
    material = bpy.data.materials.new("Studio floor")
    material.diffuse_color = (0.29, 0.29, 0.285, 1)
    floor.data.materials.append(material)
    scene.render.resolution_x = 768
    scene.render.resolution_y = 576
    scene.render.resolution_percentage = 100
    scene.cycles.samples = 7
    scene.cycles.use_denoising = True
    scene.render.use_persistent_data = True
    if sys.platform == "darwin":
        preferences = bpy.context.preferences.addons["cycles"].preferences
        try:
            preferences.compute_device_type = "METAL"
            preferences.refresh_devices()
            available = [d for d in preferences.devices if d.type == "METAL"]
            if available:
                for d in preferences.devices:
                    d.use = d.type == "METAL"
                scene.cycles.device = "GPU"
        except (TypeError, RuntimeError):
            scene.cycles.device = "CPU"

    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90


def contact(scene, folder):
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    shoes = next(o for o in scene.objects if o.name in ("Cloth_shoes", "Cloth_boots"))
    left = np.asarray([v.co.x > 0 for v in shoes.data.vertices])
    soles, root, wrist = [], [], []
    drift = []
    prior = None
    for frame in range(1, scene.frame_end + 1):
        scene.frame_set(frame)
        evaluated = shoes.evaluated_get(bpy.context.evaluated_depsgraph_get())
        co = np.empty(len(left) * 3, dtype="f")
        evaluated.data.vertices.foreach_get("co", co)
        matrix = np.asarray(evaluated.matrix_world)
        xyz = co.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]
        if prior is not None:
            support = (xyz[:, 2] < 0.006) & (prior[:, 2] < 0.006)
            if support.any():
                drift.append(
                    np.median(np.linalg.norm((xyz - prior)[support, :2], axis=1))
                )
        prior = xyz
        soles.append([xyz[left, 2].min(), xyz[~left, 2].min()])
        root.append(rig.matrix_world.translation[:])
        wrist.append(
            [
                rig.pose.bones["hand_" + s].head.z - rig.pose.bones["pelvis"].head.z
                for s in ("l", "r")
            ]
        )
    soles = np.array(soles)
    lower = soles.min(axis=1)
    ground = float(np.median(lower))
    result = {
        "frames": scene.frame_end,
        "fps": scene.render.fps,
        "action": rig.animation_data.action.name,
        "peakLeftShoeClearanceMeters": round(float(soles[:, 0].max() - ground), 4),
        "peakRightShoeClearanceMeters": round(float(soles[:, 1].max() - ground), 4),
        "medianSupportTravelPerFrameMeters": round(float(np.median(drift)), 4),
        "p95SupportTravelPerFrameMeters": round(float(np.percentile(drift, 95)), 4),
        "supportHeightRangeMeters": round(float(np.ptp(lower)), 4),
        "foreAftTravelMeters": round(float(np.ptp(np.asarray(root)[:, 1])), 4),
        "wristHeightRangeMeters": round(float(np.max(np.ptp(wrist, axis=0))), 4),
    }
    if (
        min(
            result["peakLeftShoeClearanceMeters"],
            result["peakRightShoeClearanceMeters"],
        )
        < 0.02
        or result["wristHeightRangeMeters"] < 0.15
    ):
        raise ValueError(
            f"Saved performance lacks a stride or expressive hand motion {result}"
        )
    temp = folder / f".movement-{os.getpid()}.tmp"
    temp.write_text(json.dumps(result, indent=2) + "\n")
    temp.replace(folder / "movement-check.json")
    return ground


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("resident")
    p.add_argument("output", type=Path)
    p.add_argument("--frames", nargs="*", type=int)
    p.add_argument("--check-only", action="store_true")
    a = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    folder = ROOT / "Residents" / a.resident
    bpy.ops.wm.open_mainfile(filepath=str(folder / "character.blend"), load_ui=False)
    s = bpy.context.scene
    setup(s, folder)
    ground = contact(s, folder)
    s.objects["Movement review floor"].location.z = ground - 0.001
    if a.check_only:
        sys.exit(0)
    a.output.mkdir(parents=True, exist_ok=True)
    for f in a.frames or range(s.frame_start, s.frame_end + 1):
        dest = a.output / f"{f:04d}.jpg"
        if dest.exists():
            continue
        s.frame_set(f)
        s.render.filepath = str(dest)
        bpy.ops.render.render(write_still=True)
