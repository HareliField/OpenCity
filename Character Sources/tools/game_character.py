"""Package a fitted resident and their performed actions for the city renderer."""

import argparse
import hashlib
import json
from pathlib import Path
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resident_motion import (
    ROOT,
    activate,
    captured,
    ground_action,
    portion,
    write_action,
)


def load_take(folder, filename):
    bpy.ops.wm.open_mainfile(filepath=str(folder / filename), load_ui=False)
    scene = bpy.context.scene
    rig = next(o for o in scene.objects if o.type == "ARMATURE")
    bones = list(rig.pose.bones)
    track = {b.name: [] for b in bones}
    track["location"] = []
    for f in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(f)
        track["location"].append(tuple(rig.location))
        for b in bones:
            track[b.name].append(tuple(b.matrix_basis.to_quaternion()))
    for k, rows in track.items():
        arr = np.array(rows)
        if k != "location":
            for i in range(1, len(rows)):
                if np.dot(arr[i - 1], arr[i]) < 0:
                    arr[i] *= -1
        track[k] = arr
    return track, {m.name: m.frame - scene.frame_start for m in scene.timeline_markers}


def clips(folder, recipe):
    by_file = {}
    for fname in {entry["take"] for entry in recipe.values() if "take" in entry}:
        by_file[fname] = load_take(folder, fname)
    bpy.ops.wm.open_mainfile(filepath=str(folder / "character.blend"), load_ui=False)
    rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    tracks = {}
    for name, entry in recipe.items():
        if "take" in entry:
            take, markers = by_file[entry["take"]]
            start = markers[entry["marker"]] if "marker" in entry else 0
        else:
            take = captured(rig, entry["capture"])
            start = 0
        total = len(take["location"])
        start, stop = entry.get("frames", [start, total])
        if not 0 <= start < stop <= total:
            raise ValueError(
                f"{name} requests frames {start}..{stop} from a {total}-frame take"
            )
        track = portion(take, start, stop)
        if entry.get("returnToStart"):
            track = {k: np.concatenate([a, a[-2::-1]]) for k, a in track.items()}
        if entry.get("endAtOrigin"):
            track["location"][:, :2] -= track["location"][-1, :2].copy()
        else:
            track["location"][:, :2] = 0
        if entry.get("loop"):
            for k, a in track.items():
                end = a[0]
                if k != "location" and np.dot(a[-1], end) < 0:
                    end = -end
                n = min(len(a), 5)
                for i, t in enumerate(np.linspace(0, 1, n)):
                    a[-n + i] = a[-n + i] * (1 - t) + end * t
                    if k != "location":
                        a[-n + i] /= np.linalg.norm(a[-n + i])
        if entry.get("ground"):
            idle = write_action(rig, "Measure supporting soles", track)
            activate(rig, idle)
            ground_action(bpy.context.scene, rig, idle)
            vertical = (
                idle.layers[0]
                .strips[0]
                .channelbag(idle.slots[0])
                .fcurves.find("location", index=2)
            )
            track["location"][:, 2] = [p.co.y for p in vertical.keyframe_points]
            bpy.data.actions.remove(idle)
        tracks[name] = track
    return rig, tracks


def remove_covered_skin(obj, rig):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    wrist = abs(rig.data.bones["hand_l"].head_local.x) - 0.028
    neck = rig.data.bones["neck_01"].head_local.z - 0.045
    hidden = []
    for f in bm.faces:
        center = f.calc_center_median()
        covered = center.z < neck and abs(center.x) < wrist
        if covered:
            hidden.append(f)
    bmesh.ops.delete(bm, geom=hidden, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()


def rest_mesh(obj, rig):
    armatures = [mod for mod in obj.modifiers if mod.type == "ARMATURE"]
    for mod in armatures:
        mod.show_viewport = False
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(
        obj.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps
    )
    if obj.type == "MESH":
        obj.data = mesh
        for mod in list(obj.modifiers):
            if mod not in armatures:
                obj.modifiers.remove(mod)
        for mod in armatures:
            mod.show_viewport = True
    else:
        replacement = bpy.data.objects.new(obj.name + " mesh", mesh)
        bpy.context.scene.collection.objects.link(replacement)
        world = obj.matrix_world.copy()
        replacement.parent = rig
        replacement.parent_type = "BONE"
        replacement.parent_bone = obj.parent_bone
        bpy.context.view_layer.update()
        replacement.matrix_world = world
        obj = replacement
    return obj


def bake_colour(obj, cache, size):
    # The front photograph, rear photograph and fabric dye share one runtime UV.
    original = obj.material_slots[0].material
    mat = original.copy()
    obj.material_slots[0].material = mat
    tree = mat.node_tree
    shader = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    source = shader.inputs["Base Color"]
    tile = cache / (obj.name + ".png")
    if tile.exists():
        image = bpy.data.images.load(str(tile))
    else:
        output = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL")
        emission = tree.nodes.new("ShaderNodeEmission")
        if source.links:
            tree.links.new(source.links[0].from_socket, emission.inputs[0])
        else:
            emission.inputs[0].default_value = source.default_value
        tree.links.new(emission.outputs[0], output.inputs["Surface"])
        image = bpy.data.images.new(
            obj.name + " color atlas", width=size, height=size, alpha=False
        )
        target = tree.nodes.new("ShaderNodeTexImage")
        target.image = image
        tree.nodes.active = target
        obj.data.uv_layers.active = obj.data.uv_layers["UVMap"]
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type="EMIT", margin=8, uv_layer="UVMap")
        image.filepath_raw = str(tile)
        image.file_format = "PNG"
        image.save()
    runtime = bpy.data.materials.new(obj.name + " PBR")
    runtime.use_nodes = True
    nodes = runtime.node_tree.nodes
    bs = nodes.get("Principled BSDF")
    bs.inputs["Roughness"].default_value = shader.inputs["Roughness"].default_value
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    runtime.node_tree.links.new(tex.outputs["Color"], bs.inputs["Base Color"])
    obj.material_slots[0].material = runtime
    return runtime


def prepare(folder, cache, rig):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    rig.animation_data_clear()
    rig.location = (0, 0, 0)
    for b in rig.pose.bones:
        b.matrix_basis = Matrix.Identity(4)
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()
    selected = [rig]
    objects = list(scene.objects)
    has_cards = any(o.get("runtimeHair") for o in objects)
    for o in objects:
        if o.type not in ("CURVE", "MESH") or o.name in ("Teeth", "Tongue"):
            continue
        if o.hide_render and not o.get("runtimeHair"):
            continue
        if o.type == "CURVE" and o.name == "Loose temple wisps":
            o.data = o.data.copy()
            o.data.resolution_u = 1
            o.data.bevel_resolution = 0
        if o.type == "CURVE" and len(o.data.splines) > 100:
            if has_cards:
                continue
            # Lightweight fallback for an earlier groom without game hair cards.
            o.data = o.data.copy()
            for i in reversed(range(len(o.data.splines))):
                if i % 9:
                    o.data.splines.remove(o.data.splines[i])
            o.data.bevel_resolution = 0
            o.data.resolution_u = 1
        if o.type == "MESH" and o.data.shape_keys:
            keys = o.data.shape_keys.key_blocks
            for name in ("Listening brow lift", "Cloth settling", "Delayed tips"):
                if name in keys:
                    keys[name].value = 0
        alternate = None
        if o.name == "Measured face" and o.data.shape_keys:
            face_keys = o.data.shape_keys
            face_keys.animation_data_clear()
            brow = face_keys.key_blocks.get("Listening brow lift")
            if brow:
                brow.value = 1
                bpy.context.view_layer.update()
                raised = o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
                alternate = np.empty(len(raised.vertices) * 3, dtype="f")
                raised.vertices.foreach_get("co", alternate)
                brow.value = 0
        o.hide_set(False)
        o = rest_mesh(o, rig)
        if alternate is not None:
            o.shape_key_add(name="Rest")
            o.shape_key_add(name="Listening brow lift").data.foreach_set(
                "co", alternate
            )
        if (
            o.name == "Body"
            and scene.objects.get("Cloth_jacket")
            and scene.objects.get("Cloth_jeans")
        ):
            remove_covered_skin(o, rig)
        if o.name in (
            "Body",
            "Cloth_jacket",
            "Cloth_tshirt",
            "Cloth_jeans",
            "Cloth_shoes",
        ):
            source = o.material_slots[0].material
            shader = next(
                n for n in source.node_tree.nodes if n.type == "BSDF_PRINCIPLED"
            )
            incoming = shader.inputs["Base Color"].links
            if not (incoming and incoming[0].from_node.type == "TEX_IMAGE"):
                bake_colour(o, cache, 1024 if o.name == "Cloth_jacket" else 512)
        if o.name == "Body" or o.name.startswith("Cloth_"):
            # Coverage and projection attributes have already been baked. glTF
            # COLOR_0 would otherwise multiply the finished albedo a second time.
            for attribute in list(o.data.color_attributes):
                o.data.color_attributes.remove(attribute)
            for layer in list(o.data.uv_layers):
                if layer.name in ("Front garment", "Face detail"):
                    o.data.uv_layers.remove(layer)
        selected.append(o)
    rig.data.pose_position = "POSE"
    return selected


def scale_game_textures(models, limit):
    # Resize an export-only copy. The original photographic textures remain in the master.
    scaled = {}
    for obj in models:
        for slot in obj.material_slots:
            material = slot.material
            if not material or not material.use_nodes:
                continue
            for node in material.node_tree.nodes:
                if (
                    node.type != "TEX_IMAGE"
                    or not node.image
                    or max(node.image.size) <= limit
                ):
                    continue
                image = node.image
                if image not in scaled:
                    w, h = image.size
                    ratio = limit / max(w, h)
                    small = image.copy()
                    small.scale(max(1, round(w * ratio)), max(1, round(h * ratio)))
                    small.pack()
                    scaled[image] = small
                node.image = scaled[image]


def export(folder, output, cache_root, texture_limit=None):
    recipe_file = folder / "game-actions.json"
    recipe = (
        json.loads(recipe_file.read_text())
        if recipe_file.exists()
        else {
            "Idle": {
                "capture": "idle_shift",
                "frames": [12, 78],
                "loop": True,
                "ground": True,
            },
            "Walk": {"capture": "walk_stop", "frames": [1, 29], "loop": True},
            "Talk": {"capture": "explain", "frames": [215, 280]},
            "Recover": {"capture": "get_up", "frames": [12, 106], "endAtOrigin": True},
        }
    )
    inputs = {
        Path(__file__),
        Path(__file__).with_name("game_expression.py"),
        Path(__file__).with_name("resident_motion.py"),
        folder / "character.blend",
        ROOT / "Anatomy/sculpts.blend",
    }
    if recipe_file.exists():
        inputs.add(recipe_file)
    for entry in recipe.values():
        if "take" in entry:
            inputs.add(folder / entry["take"])
        else:
            inputs.add(ROOT / "Motion" / (entry["capture"] + ".npz"))
    inputs.update(
        p
        for suffix in ("*.png", "*.jpg")
        for p in folder.glob(suffix)
        if "review" not in p.name
        and "turntable" not in p.name
        and "comparison" not in p.name
    )
    inputs.update((ROOT / "Anatomy/Textures").glob("*"))
    digest = hashlib.sha256(f"{bpy.app.version_string}/{texture_limit}".encode())
    for path in sorted(inputs):
        if path.is_file():
            digest.update(path.name.encode())
            digest.update(hashlib.sha256(path.read_bytes()).digest())
    cache = cache_root / digest.hexdigest()
    cache.mkdir(parents=True, exist_ok=True)
    receipt = cache / "output.sha256"
    if (
        output.exists()
        and receipt.exists()
        and hashlib.sha256(output.read_bytes()).hexdigest() == receipt.read_text()
    ):
        print("Reused verified package", output)
        return
    rig, tracks = clips(folder, recipe)
    models = prepare(folder, cache, rig)
    if texture_limit:
        scale_game_textures(models, texture_limit)
    ad = rig.animation_data_create()
    for name, track in tracks.items():
        action = write_action(rig, name, track)
        nla = ad.nla_tracks.new()
        nla.name = name
        strip = nla.strips.new(name, 1, action)
        strip.action_slot = action.slots[0]
        nla.mute = True
    bpy.ops.object.select_all(action="DESELECT")
    for obj in models:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as temp:
        target = Path(temp) / "resident.glb"
        bpy.ops.export_scene.gltf(
            filepath=str(target),
            use_selection=True,
            export_animation_mode="NLA_TRACKS",
            export_nla_strips=True,
            export_morph=True,
            export_morph_animation=False,
            export_morph_normal=False,
            export_optimize_animation_keep_anim_armature=False,
            export_anim_slide_to_zero=True,
            export_extras=False,
            export_force_sampling=True,
            export_image_format="WEBP",
            export_image_quality=95,
            export_jpeg_quality=92,
        )
        from game_expression import add_brow_performance

        meta = add_brow_performance(target, recipe.get("Talk", {}).get("brow"))
        if set(a["name"] for a in meta.get("animations", [])) != set(tracks):
            raise ValueError(
                f"Packaged clips differ from expected: {[a['name'] for a in meta.get('animations', [])]}"
            )
        target.replace(output)
        receipt.write_text(hashlib.sha256(output.read_bytes()).hexdigest())
    print("Packaged", output, output.stat().st_size, "bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("resident")
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--cache",
        type=Path,
        default=Path(tempfile.gettempdir()) / "asphalt-resident-atlases",
    )
    parser.add_argument(
        "--texture-size",
        type=int,
        choices=[256, 512, 768, 1024, 2048],
        help="Maximum texture dimension for a compact game copy",
    )
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    export(
        ROOT / "Residents" / args.resident,
        args.output.resolve(),
        args.cache,
        args.texture_size,
    )
