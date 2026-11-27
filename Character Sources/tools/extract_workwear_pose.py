"""Read the evaluated gameplay Idle triangles and clothing UVs in background Blender."""

import argparse
import sys
from pathlib import Path

import bpy
import numpy as np


def extract(package, frame, output):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(package.resolve()))
    scene = bpy.context.scene
    rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    action = bpy.data.actions["Idle"]
    rig.animation_data.action = action
    rig.animation_data.action_slot = next(slot for slot in action.slots if slot.target_id_type == "OBJECT")
    scene.frame_set(frame)
    graph = bpy.context.evaluated_depsgraph_get()
    positions, normals, mappings, classes = [], [], [], []
    garments = ("Cloth_jacket", "Cloth_tshirt", "Cloth_jeans", "Cloth_shoes")
    for obj in scene.objects:
        if obj.type != "MESH" or obj.hide_render or obj.name.startswith("Icosphere"):
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            coords = np.zeros((len(mesh.vertices), 3), "f")
            mesh.vertices.foreach_get("co", coords.ravel())
            loops = np.zeros((len(mesh.loop_triangles), 3), "i")
            mesh.loop_triangles.foreach_get("loops", loops.ravel())
            vertices = np.zeros(len(mesh.loops), "i")
            mesh.loops.foreach_get("vertex_index", vertices)
            uv = np.zeros((len(mesh.loops), 2), "f")
            if mesh.uv_layers.active:
                mesh.uv_layers.active.data.foreach_get("uv", uv.ravel())
            uv[:, 1] = 1 - uv[:, 1]
            world = np.asarray(evaluated.matrix_world)
            posed = (coords @ world[:3, :3].T + world[:3, 3])[vertices[loops]]
            normal = np.cross(posed[:, 1] - posed[:, 0], posed[:, 2] - posed[:, 0])
            normal /= np.maximum(np.linalg.norm(normal, axis=1), 1e-9)[:, None]
            category = next((index for index, name in enumerate(garments, 1) if obj.name.startswith(name)), 0)
            positions.append(posed.astype("f"))
            normals.append(normal.astype("f"))
            mappings.append(uv[loops].astype("f"))
            classes.append(np.full(len(posed), category, "i"))
        finally:
            evaluated.to_mesh_clear()
    np.savez_compressed(output, xyz=np.concatenate(positions), normal=np.concatenate(normals),
                        uv=np.concatenate(mappings), cls=np.concatenate(classes))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--frame", type=int, default=13)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    extract(args.package, args.frame, args.output)
