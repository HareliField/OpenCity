"""Build anchored fabric and hair displacements on the evaluated game mesh."""

import numpy as np


def add_target(obj, coords, name, displacement):
    if not np.max(np.abs(displacement)) > 0.00005:
        return
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Rest")
    key = obj.shape_key_add(name=name)
    key.slider_min = -1
    key.value = 0.0
    key.data.foreach_set("co", (coords + displacement).astype("f").ravel())


def add_secondary_shapes(obj, rig):
    name = obj.name
    hair = name.startswith(("Loose temple and coiled", "Loose temple wisps"))
    hood = name == "Folded windbreaker hood"
    garment = name == "Cloth_jacket"
    trim = name.startswith(("Windbreaker zip", "Thread through the bottom"))
    if not (hair or hood or garment or trim):
        return
    mesh = obj.data
    coords = np.empty((len(mesh.vertices), 3), dtype="f")
    mesh.vertices.foreach_get("co", coords.ravel())
    x, y, z = coords.T
    bones = rig.data.bones
    if hair:
        # Lower temple locks are free to swing. Keep the knot and the overlapping
        # crown cards attached to the scalp. Ribbon UVs run from root to tip.
        crown = bones["head"].head_local.z
        free = np.clip((crown + 0.048 - z) / 0.096, 0, 1) ** 1.5
        free *= np.clip((-y - 0.025) / 0.04, 0, 1)
        if name.startswith("Loose temple and"):
            loops = np.empty(len(mesh.loops), dtype=np.int32)
            mesh.loops.foreach_get("vertex_index", loops)
            uv = np.empty((len(loops), 2), dtype="f")
            mesh.uv_layers.active.data.foreach_get("uv", uv.ravel())
            tip = np.zeros(len(coords), dtype="f")
            np.maximum.at(tip, loops, (1 - uv[:, 1]) ** 2)
            free *= tip
        prefix = "Groom"
        reach = 0.024
    elif hood:
        free = np.clip((z.max() - z) / max(0.06, float(np.ptp(z))), 0, 1) ** 1.3
        prefix = "Hood"
        reach = 0.017
    else:
        hem = bones["pelvis"].head_local.z - 0.076
        free = np.clip((hem + 0.23 - z) / 0.23, 0, 1) ** 1.7
        free *= np.clip((0.31 - abs(x)) / 0.095, 0, 1)
        prefix = "Hem"
        reach = 0.012

    side = np.zeros_like(coords)
    side[:, 0] = reach * free
    side[:, 2] = free * (0.0018 * np.sin(x * 34))
    drag = np.zeros_like(coords)
    drag[:, 1] = reach * free
    drag[:, 2] = free * (0.0025 * np.cos(x * 28))
    add_target(obj, coords, prefix + " side", side)
    add_target(obj, coords, prefix + " drag", drag)

    if garment:
        if obj.get("scanWorkwear"):
            # The scanned hood is part of the jacket. Let the rear fold lift
            # off the shoulders while the front collar and zipper stay anchored.
            collar = bones["neck_01"].head_local
            fold = np.clip((z - collar.z + 0.18) / 0.14, 0, 1)
            fold *= np.clip((y - collar.y + 0.035) / 0.11, 0, 1)
            fold *= np.clip((0.22 - abs(x - collar.x)) / 0.11, 0, 1)
            for axis, label in ((0, "Hood side"), (1, "Hood drag")):
                displacement = np.zeros_like(coords)
                displacement[:, axis] = 0.017 * fold
                displacement[:, 2] = 0.002 * fold
                add_target(obj, coords, label, displacement)
        normals = np.empty_like(coords)
        mesh.vertices.foreach_get("normal", normals.ravel())
        for suffix in ("l", "r"):
            elbow = np.asarray(bones["lowerarm_" + suffix].head_local)
            wrist = np.asarray(bones["hand_" + suffix].head_local)
            forearm = wrist - elbow
            forearm /= np.linalg.norm(forearm)
            offset = coords - elbow
            axial = offset @ forearm
            radial = np.linalg.norm(offset - axial[:, None] * forearm, axis=1)
            envelope = np.exp(-(((axial - 0.015) / 0.070) ** 2))
            envelope *= np.clip((0.110 - radial) / 0.035, 0, 1)
            # As the elbow closes, cloth gathers towards the inside of the hinge.
            # The outside extends over the elbow point with a longer, shallower fold.
            shoulder = np.asarray(bones["upperarm_" + suffix].head_local)
            inward = (shoulder - elbow) - forearm * np.dot(shoulder - elbow, forearm)
            inward /= max(0.001, np.linalg.norm(inward))
            away = offset - axial[:, None] * forearm
            direction = away / np.maximum(radial[:, None], 0.001)
            inside = np.clip((direction @ inward + 0.32) / 1.32, 0, 1)
            side = direction[:, 0] * (1 if suffix == "l" else -1)
            bias = axial + 0.024 * side + 0.012 * (direction @ inward)
            ridge = np.exp(-(((bias - 0.020) / 0.014) ** 2)) - 0.52 * np.exp(
                -(((bias + 0.004) / 0.011) ** 2)
            )
            ridge += 0.78 * np.exp(-(((bias - 0.066) / 0.012) ** 2)) - 0.37 * np.exp(
                -(((bias - 0.049) / 0.014) ** 2)
            )
            height = envelope * (0.003 + 0.009 * inside) * ridge
            add_target(obj, coords, "Sleeve fold " + suffix, normals * height[:, None])
