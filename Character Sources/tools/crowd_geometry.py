"""Decode the MakeHuman sculpt targets and fit skin and bind joints for the streamed cast."""

from functools import lru_cache
import json
from pathlib import Path
import struct
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DTYPE = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


@lru_cache(None)
def source(name):
    blob = (ROOT / "Anatomy" / (name + ".glb")).read_bytes()
    size = struct.unpack_from("<I", blob, 12)[0]
    return json.loads(blob[20 : 20 + size]), memoryview(blob)[28 + size :]


@lru_cache(None)
def accessor(name, idx):
    data, blob = source(name)
    a = data["accessors"][idx]
    dtype = np.dtype(DTYPE[a["componentType"]])
    width = WIDTH[a["type"]]

    def rows(view, offset, count, dtype, width):
        item = data["bufferViews"][view]
        start = item.get("byteOffset", 0) + offset
        stride = item.get("byteStride", dtype.itemsize * width)
        return np.ndarray(
            (count, width),
            dtype=dtype,
            buffer=blob,
            offset=start,
            strides=(stride, dtype.itemsize),
        )

    if "bufferView" in a:
        out = rows(a["bufferView"], a.get("byteOffset", 0), a["count"], dtype, width)
    else:
        out = np.zeros((a["count"], width), dtype)
    if "sparse" in a:
        sparse = a["sparse"]
        indices = sparse["indices"]
        val = sparse["values"]
        count = sparse["count"]
        ids = rows(
            indices["bufferView"],
            indices.get("byteOffset", 0),
            count,
            np.dtype(DTYPE[indices["componentType"]]),
            1,
        ).ravel()
        out = out.copy()
        out[ids] = rows(
            val["bufferView"], val.get("byteOffset", 0), count, dtype, width
        )
    if a.get("normalized"):
        out = np.maximum(out.astype("f") / np.iinfo(dtype).max, -1)
    return out


def morph(name, mesh, primitive, weights, attr="POSITION"):
    values = dict(weights)
    targets = mesh["extras"]["targetNames"]
    original = accessor(name, primitive["attributes"][attr])
    result = original.copy()
    for key, target in zip(targets, primitive["targets"]):
        if key.startswith("corr_"):
            left, right = key[5:].split("__")
            value = values.get(left, 0) * values.get(right, 0)
        else:
            value = values.get(key, 0)
        if value and attr in target:
            result += value * accessor(name, target[attr])
    return result


@lru_cache(None)
def topology():
    lines = (ROOT / "Anatomy/face-topology.obj").read_text().splitlines()
    return np.array(
        [
            [int(v.split("/")[0]) - 1 for v in line.split()[1:]]
            for line in lines
            if line.startswith("f ")
        ]
    )


def sculpt_face(body, eyes, folder, fit):
    marks = np.fromfile(folder / "face-sculpt.bin", "<f4").reshape(468, 3)
    w, h = fit["sourcePixels"]
    points = marks * [w, h, w]
    center = (points[33] + points[263]) / 2
    ratio = np.ptp(eyes[:, 0]) * 0.97 / max(1, points[263, 0] - points[33, 0])
    p = (points - center) * ratio
    origin_y = (eyes[:, 1].min() + eyes[:, 1].max()) * 0.5
    target_xy = np.column_stack((p[:, 0], origin_y - p[:, 1]))
    desired_z = eyes[:, 2].max() - 0.0005 - p[:, 2]
    # Project measured depth onto the native continuous face, so cheeks and lips
    # stay attached to the head from all viewpoints and the eyes can still rotate.
    lo = target_xy.min(0) - 0.003
    unit = 1100.0
    ij = (target_xy - lo) * unit
    shape = np.ceil(ij.max(0) + 3).astype(int)[::-1]
    depth = np.zeros(shape, np.float32)
    valid = np.zeros(shape, np.uint8)
    for triangle in topology():
        uv = ij[triangle]
        vs = desired_z[triangle]
        # Interpolate depth across each measured triangle rather than stamping a flat patch.
        start = np.maximum(0, np.floor(uv.min(0)).astype(int))
        end = np.minimum(shape[::-1], np.ceil(uv.max(0) + 1).astype(int))
        if (end <= start).any():
            continue
        ys, xs = np.mgrid[start[1] : end[1], start[0] : end[0]]
        rel = np.stack((xs - uv[0, 0], ys - uv[0, 1]), axis=-1)
        axes = uv[1:] - uv[0]
        determinant = axes[0, 0] * axes[1, 1] - axes[0, 1] * axes[1, 0]
        if abs(determinant) < 1.0e-7:
            continue
        u = (rel[:, :, 0] * axes[1, 1] - rel[:, :, 1] * axes[1, 0]) / determinant
        v = (rel[:, :, 1] * axes[0, 0] - rel[:, :, 0] * axes[0, 1]) / determinant
        inside = (u >= 0) & (v >= 0) & (u + v <= 1)
        depth[ys[inside], xs[inside]] = (
            vs[0] + u * (vs[1] - vs[0]) + v * (vs[2] - vs[0])
        )[inside]
        valid[ys[inside], xs[inside]] = 255
    ij = np.rint((body[:, :2] - lo) * unit).astype(int)
    keep = np.flatnonzero(
        (ij[:, 0] >= 0)
        & (ij[:, 1] >= 0)
        & (ij[:, 0] < shape[1])
        & (ij[:, 1] < shape[0])
        & (body[:, 2] > 0.054)
    )
    px, py = ij[keep].T
    strength = np.clip(
        cv2.distanceTransform(valid, cv2.DIST_L2, 5)[py, px] / 12.0, 0, 1
    )
    body[keep, 2] += strength * np.clip(depth[py, px] - body[keep, 2], -0.014, 0.014)


JOINTS = json.loads((ROOT / "Anatomy/joint-targets.json").read_text())["morphs"]


def fit_skeleton(nodes, skin, weights):
    source_g, _ = source("base_body")
    joint_ids = skin["joints"]
    inverse = (
        accessor("base_body", source_g["skins"][0]["inverseBindMatrices"])
        .reshape(-1, 4, 4)
        .transpose(0, 2, 1)
    )
    world = np.linalg.inv(inverse).astype("d")
    slots = {name: i for i, name in enumerate(nodes[n]["name"] for n in joint_ids)}
    for key, val in weights.items():
        for name, delta in JOINTS.get(key, {}).items():
            if name in slots:
                world[slots[name], :3, 3] += np.asarray(delta) * val
    parents = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}
    positions = {n: i for i, n in enumerate(joint_ids)}
    for i, n in enumerate(joint_ids):
        parent = parents.get(n)
        mat = (
            world[i]
            if parent not in positions
            else np.linalg.solve(world[positions[parent]], world[i])
        )
        nodes[n]["translation"] = mat[:3, 3].round(8).tolist()
    return np.linalg.inv(world).transpose(0, 2, 1).astype("<f4").reshape(-1, 16)


@lru_cache(None)
def uv_pixels(name, size):
    """Barycentric map from an anatomical/material UV tile to the frontal photograph."""
    g, _ = source(name)
    p = g["meshes"][0]["primitives"][0]
    attrs = p["attributes"]
    uv = accessor(name, attrs["TEXCOORD_0"]) * size - 0.5
    index = accessor(name, p["indices"]).reshape(-1, 3)
    base = accessor(name, attrs["POSITION"])
    normal = accessor(name, attrs["NORMAL"])
    tris = np.full((size, size), -1, np.int32)
    coeff = np.zeros((size, size, 2), "f")
    for i, triangle in enumerate(index):
        geom = base[triangle]
        facing = normal[triangle, 2]
        if facing.max() < 0.06:
            continue
        if name == "base_body" and (
            geom[:, 1].max() < 1.425 or geom[:, 2].max() < 0.05
        ):
            continue
        pix = uv[triangle]
        lo = np.maximum(0, np.floor(pix.min(0)).astype(int))
        hi = np.minimum(size, np.ceil(pix.max(0) + 1).astype(int))
        if (hi <= lo).any():
            continue
        yy, xx = np.mgrid[lo[1] : hi[1], lo[0] : hi[0]]
        a, b = pix[1:] - pix[0]
        det = a[0] * b[1] - a[1] * b[0]
        if abs(det) < 1.0e-8:
            continue
        dx = xx - pix[0, 0]
        dy = yy - pix[0, 1]
        u = (dx * b[1] - dy * b[0]) / det
        v = (a[0] * dy - a[1] * dx) / det
        keep = (u >= -0.005) & (v >= -0.005) & (u + v <= 1.005)
        ys = yy[keep]
        xs = xx[keep]
        tris[ys, xs] = i
        coeff[ys, xs] = np.stack((u[keep], v[keep]), axis=1)
    iy, ix = np.nonzero(tris >= 0)
    tri = index[tris[iy, ix]]
    a, b = coeff[iy, ix].T
    weight = np.stack((1 - a - b, a, b), axis=1)
    facing = (normal[tri, 2] * weight).sum(1)
    return iy, ix, tri, weight, np.clip((facing - 0.06) / 0.6, 0, 1)
