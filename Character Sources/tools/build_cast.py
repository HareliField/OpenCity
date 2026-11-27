"""Build complete skinned glTF scenes, sharing the anatomical library's buffers."""

import argparse
from copy import deepcopy
from functools import lru_cache
import json
from pathlib import Path
import struct
from design import design

ROOT = Path(__file__).resolve().parents[1]


@lru_cache(None)
def library(name):
    path = ROOT / "Anatomy" / (name + ".glb")
    with path.open("rb") as f:
        header = f.read(20)
        (size,) = struct.unpack_from("<I", header, 12)
        g = json.loads(f.read(size))
    return g, size + 28, path.stat().st_size


def linear_colour(hex_value):
    c = [int(hex_value[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return [
        round(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4, 5) for v in c
    ] + [1]


class Scene:
    def __init__(self, person, layers, colours, weights):
        self.person = person
        self.layers = layers
        self.colours = colours
        self.weights = weights
        self.g = {
            k: []
            for k in [
                "nodes",
                "meshes",
                "materials",
                "skins",
                "accessors",
                "bufferViews",
                "textures",
                "images",
                "samplers",
                "buffers",
            ]
        }
        self.g.update(
            asset={
                "version": "2.0",
                "generator": "Open City resident sculpt library",
            },
            scene=0,
            scenes=[{"name": person["name"], "nodes": [0]}],
            extensionsRequired=["KHR_mesh_quantization"],
            extensionsUsed=["KHR_mesh_quantization"],
        )

    def append(self, section, value):
        block = self.g[section]
        block.append(value)
        return len(block) - 1

    def add(self, name):
        src, start, size = library(name)
        buf = self.append(
            "buffers", {"byteLength": size, "uri": "../../Anatomy/" + name + ".glb"}
        )
        cache = {}

        def remap(kind, i):
            key = kind, i
            if key in cache:
                return cache[key]
            obj = deepcopy(src[kind][i])
            if kind == "bufferViews":
                obj.update(buffer=buf, byteOffset=start + obj.get("byteOffset", 0))
            elif kind == "accessors":
                if "bufferView" in obj:
                    obj["bufferView"] = remap("bufferViews", obj["bufferView"])
                for s in obj.get("sparse", {}).values():
                    if isinstance(s, dict) and "bufferView" in s:
                        s["bufferView"] = remap("bufferViews", s["bufferView"])
            elif kind == "images":
                obj["bufferView"] = remap("bufferViews", obj["bufferView"])
            elif kind == "textures":
                obj["source"] = remap("images", obj["source"])
                if "sampler" in obj:
                    obj["sampler"] = remap("samplers", obj["sampler"])
            elif kind == "materials":
                pbr = obj["pbrMetallicRoughness"]
                for block in (pbr, obj):
                    for k, v in block.items():
                        if k.endswith("Texture") and isinstance(v, dict):
                            v["index"] = remap("textures", v["index"])
                label = obj["name"]
                region = None
                if label == "Skin":
                    region = "Skin"
                if name.startswith("hair_") or label == "Eyebrow":
                    region = "Hair"
                if name.startswith("clothing_"):
                    region = (
                        "Trousers"
                        if name
                        in ("clothing_jeans", "clothing_shorts", "clothing_skirt")
                        else "Shoes"
                        if name in ("clothing_boots", "clothing_shoes")
                        else "Undershirt"
                        if name == "clothing_tshirt"
                        and "clothing_jacket" in self.layers
                        or name == "clothing_tshirt"
                        and "clothing_trenchcoat" in self.layers
                        else "Top"
                    )
                if region:
                    pbr["baseColorFactor"] = linear_colour(self.colours[region])
            index = self.append(kind, obj)
            cache[key] = index
            return index

        if name == "base_body":
            self.g["nodes"] = deepcopy(src["nodes"])
            root = src["scenes"][0]["nodes"][0]
            self.root = self.g["nodes"][root]
            self.g["scenes"][0]["nodes"] = [root]
            self.root.update(name=self.person["name"], extras={"persona": self.person})
            skin = deepcopy(src["skins"][0])
            skin["inverseBindMatrices"] = remap(
                "accessors", skin["inverseBindMatrices"]
            )
            self.append("skins", skin)
        elif (
            src["skins"][0]["joints"] != self.g["skins"][0]["joints"]
            or src["nodes"][:53] != library("base_body")[0]["nodes"][:53]
        ):
            raise ValueError("Mismatched bind skeleton for " + name)
        for i, mesh in enumerate(src["meshes"]):
            names = mesh["extras"]["targetNames"]
            values = {**self.weights, "blink_left": 0, "blink_right": 0}
            for key in names:
                if key.startswith("corr_"):
                    a, b = key[5:].split("__")
                    if a in values and b in values:
                        values[key] = round(values[a] * values[b], 5)
            keep = [k for k, key in enumerate(names) if key in values]
            obj = {
                "name": mesh["name"],
                "extras": {"targetNames": [names[k] for k in keep]},
                "weights": [values[names[k]] for k in keep],
                "primitives": [],
            }
            for p in mesh["primitives"]:
                q = {
                    **p,
                    "indices": remap("accessors", p["indices"]),
                    "material": remap("materials", p["material"]),
                    "attributes": {
                        a: remap("accessors", v)
                        for a, v in p["attributes"].items()
                        if not a.startswith("_")
                    },
                    "targets": [
                        {a: remap("accessors", v) for a, v in p["targets"][k].items()}
                        for k in keep
                    ],
                }
                obj["primitives"].append(q)
            mesh_i = self.append("meshes", obj)
            if name != "base_body":
                node = deepcopy(next(x for x in src["nodes"] if x.get("mesh") == i))
                node.update(mesh=mesh_i, skin=0)
                self.root["children"].append(self.append("nodes", node))


def build(folder):
    person = json.loads((folder / "persona.json").read_text())
    fit = folder / "photo-fit.json"
    layers, colours, weights = design(
        person, json.loads(fit.read_text()) if fit.exists() else None
    )
    from appearance_recipes import fitted_layers

    layers = fitted_layers(folder, layers)
    scene = Scene(person, layers, colours, weights)
    for name in ["base_body"] + layers:
        scene.add(name)
    scene.root["extras"]["appearanceSource"] = (
        "photo measurements and biography"
        if fit.exists()
        else "biography casting design"
    )
    encoded = json.dumps(scene.g, ensure_ascii=False, separators=(",", ":")) + "\n"
    dest = folder / "character.gltf"
    if not dest.exists() or dest.read_text() != encoded:
        temp = dest.with_suffix(".tmp")
        temp.write_text(encoded)
        temp.replace(dest)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ids", nargs="*")
    args = parser.parse_args()
    folders = (
        [ROOT / "Residents" / key for key in args.ids]
        if args.ids
        else sorted((ROOT / "Residents").glob("AH-R*"))
    )
    for folder in folders:
        build(folder)
    print(f"Built {len(folders)} rigged character scenes")
