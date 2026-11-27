"""Manufacture independently poseable, image-fitted residents with content-addressed shared topology."""

import argparse
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import tempfile

import cv2
import numpy as np
from cast_pose import CastingPose
from cast_surfaces import Surfaces, REGIONS
from crowd_geometry import ROOT
from cast_package import Package, encode, shared_texture
from cast_direction import HAIR

FACTORY = 7


def atomic(path, data):
    if path.exists() and path.read_bytes() == data:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
        f.write(data)
        name = f.name
    os.chmod(name, 0o644)
    os.replace(name, path)


def identity(person):
    digest = hashlib.sha256(
        (
            person["life"] + person["appearance"] + person["reactions"][0]["response"]
        ).encode()
    ).digest()
    rates = [x / 255 for x in digest[:4]]
    return {
        "gait": round(
            (0.92 + 0.19 * rates[0]) * (0.92 if person["age"] > 65 else 1), 3
        ),
        "attention": round(2 + 3.4 * rates[1], 2),
        "blinkInterval": round(2.7 + 2.7 * rates[2], 2),
        "stride": round(0.88 + 0.18 * rates[3], 3),
        "situation": person["reactions"][0]["situation"],
        "response": person["reactions"][0]["response"],
    }


def publish_model(folder, output, hand_model=None):
    fit = json.loads((folder / "photo-fit.json").read_text())
    key = folder.name
    model = output / "cast" / f"{key}.gltf"
    if model.exists():
        document = json.loads(model.read_bytes())
        current = document["asset"].get("extras", {})
        if (
            current.get("factory") == FACTORY
            and current.get("reference") == fit["referenceSha256"]
            and (folder / "character.gltf").is_file()
            and all(
                (model.parent / entry["uri"]).is_file()
                for entry in document["buffers"] + document["images"]
            )
        ):
            return
    if hand_model:
        from cast_hands import measure_hands

        measure_hands(folder, fit, hand_model)
    pose = CastingPose(folder)
    surface = Surfaces(pose)
    parts = surface.build()
    p = pose.person
    pack = Package(output, p)
    pack.nodes[: len(pose.nodes)] = pose.nodes
    tex_name = key + "-surface.jpg"
    atomic(output / "cast" / tex_name, surface.texture)
    tex = pack.map_image(tex_name)
    for kind in REGIONS:
        material = {
            "name": {
                "skin": "Skin and corneas",
                "hair": "Hair fibres",
                "shirt": pose.coat_cue,
                "trousers": "Trouser cloth",
                "shoe": "Footwear",
            }[kind],
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": tex},
                "metallicFactor": 0,
                "roughnessFactor": {
                    "skin": 0.75,
                    "hair": 0.64,
                    "shirt": 0.86,
                    "trousers": 0.88,
                    "shoe": 0.69,
                }[kind],
            },
            "doubleSided": True,
        }
        pack.materials.append(material)
    from build_cast import linear_colour

    hair_part = "hair_" + HAIR[pose.hair_cue][0]
    index = pack.map_image(shared_texture(output, hair_part, 0))
    hair = linear_colour(fit["colours"].get("Hair", "#4e4136"))
    # Strand maps already carry pigment; scale their neutral fibre colour into the photographed range.
    factor = [min(1, max(0.07, (v**0.50) * 1.8)) for v in hair[:3]] + [1]
    pack.materials.append(
        {
            "name": "Temple and nape fibres",
            "alphaMode": "MASK",
            "alphaCutoff": 0.28,
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": index},
                "baseColorFactor": factor,
                "metallicFactor": 0,
                "roughnessFactor": 0.73,
            },
        }
    )
    for name, kind, v, n, uv, j, wt, tri, shapes in parts:
        if not (
            np.isfinite(v).all() and np.isfinite(uv).all() and np.isfinite(n).all()
        ):
            raise ValueError(f"{key}: invalid {name} geometry")
        # Integer UV and skin weights are native glTF types. The geometry and sculpted normals stay full precision.
        joint = np.asarray(j, "uint8")
        weight = np.rint(np.clip(wt, 0, 1) * 255).astype("int16")
        weight[np.arange(len(weight)), np.argmax(weight, axis=1)] += 255 - weight.sum(1)
        texcoords = pack.add_array(np.uint16(np.clip(uv, 0, 1) * 65535 + 0.5), "VEC2")
        pack.acc[texcoords]["normalized"] = True
        wref = pack.add_array(weight.astype("uint8"), "VEC4")
        pack.acc[wref]["normalized"] = True
        ids = np.asarray(tri, "<u2").ravel()
        ix = pack.add_array(
            ids,
            "SCALAR",
            "faces" if name not in ("Front hairline and locks", "Body") else None,
        )
        attrs = {
            "POSITION": pack.add_array(np.float32(v), "VEC3", bounds=True),
            "NORMAL": pack.add_array(np.float32(n), "VEC3"),
            "TEXCOORD_0": texcoords,
            "JOINTS_0": pack.add_array(joint, "VEC4"),
            "WEIGHTS_0": wref,
        }
        prim = {
            "attributes": attrs,
            "material": (
                len(REGIONS) if kind == "native-hair" else REGIONS.index(kind)
            ),
            "indices": ix,
        }
        mesh = {"name": name, "primitives": [prim]}
        if shapes:
            mesh["weights"] = [0] * len(shapes)
            mesh["extras"] = {"targetNames": list(shapes)}
            prim["targets"] = [
                {"POSITION": pack.add_array(np.asarray(m, "<f4"), "VEC3", bounds=True)}
                for m in shapes.values()
            ]
        pack.nodes[pack.root]["children"].append(len(pack.nodes))
        pack.nodes.append({"mesh": len(pack.meshes), "skin": 0, "name": name})
        pack.meshes.append(mesh)
    skin = deepcopy(pose.skin)
    skin["inverseBindMatrices"] = pack.add_array(pose.inverse, "MAT4")
    pack.buffers[0] = {"uri": key + ".bin", "byteLength": len(pack.binary)}
    doc = {
        "asset": {
            "version": "2.0",
            "generator": "Asphalt Heat photograph-fitted character factory",
            "extras": {"factory": FACTORY, "reference": fit["referenceSha256"]},
        },
        "scene": 0,
        "scenes": [{"nodes": [pack.root]}],
        "nodes": pack.nodes,
        "meshes": pack.meshes,
        "skins": [skin],
        "images": pack.images,
        "textures": pack.textures,
        "materials": pack.materials,
        "buffers": pack.buffers,
        "bufferViews": pack.views,
        "accessors": pack.acc,
    }
    pack.nodes[pack.root]["extras"].update(
        name=p["name"], occupation=p["occupation"], performance=identity(p)
    )
    atomic(output / "cast" / (key + ".bin"), pack.binary)
    atomic(model, encode(doc))
    # A second standard glTF manifest lets artists import from the individual source
    # folder without keeping a second copy of the geometry, maps or bind data.
    link = "../" * 3 + "asphalt-heat/assets/residents/cast/"
    for item in doc["buffers"] + doc["images"]:
        item["uri"] = link + item["uri"]
    atomic(folder / "character.gltf", encode(doc))


def roster(output):
    rows = []
    for f in sorted((ROOT / "Residents").glob("AH-R*")):
        p = json.loads((f / "persona.json").read_text())
        r = {
            k: p[k]
            for k in (
                "residentId",
                "personId",
                "name",
                "age",
                "occupation",
                "home",
                "voice",
                "agenda",
                "appearance",
                "episode",
                "life",
                "personality",
                "family",
                "connections",
                "familyIds",
                "connectionIds",
                "reactions",
                "biography",
            )
        }
        r["performance"] = identity(p)
        r["model"] = (
            "ida-mercer.glb" if f.name == "AH-R0001" else "cast/" + f.name + ".gltf"
        )
        rows.append(r)
    atomic(output / "cast.json", encode(rows))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--hand-model", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--roster", action="store_true")
    a = ap.parse_args()
    output = a.output.resolve()
    for sub in ("cast", "library"):
        (output / sub).mkdir(parents=True, exist_ok=True)
    cv2.setNumThreads(1)
    if a.roster:
        roster(output)
    keys = a.ids or sorted(
        f.name
        for f in (ROOT / "Residents").glob("*/subject-mask.png")
        for f in [f.parent]
    )
    count = 0
    for key in keys:
        if key == "AH-R0001":
            continue
        publish_model(ROOT / "Residents" / key, output, a.hand_model)
        count += 1
        if count % 50 == 0 or count == len(keys):
            print(f"{count} fitted game models", flush=True)
