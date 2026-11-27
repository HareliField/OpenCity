"""Bake each photograph-fitted street resident for the game, sharing immutable mesh attributes."""

import argparse
from copy import deepcopy
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

from build_cast import linear_colour
from crowd_geometry import (
    ROOT,
    source,
    accessor,
    morph,
    fit_skeleton,
    sculpt_face,
    uv_pixels,
)
from design import design


def encode(data):
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()


def publish(path, content):
    if path.is_file() and path.read_bytes() == content:
        return
    dest = path.with_suffix(path.suffix + ".tmp")
    dest.write_bytes(content)
    dest.replace(path)


@lru_cache(None)
def texture_image(part, number):
    import io

    g, blob = source(part)
    image = g["images"][number]
    view = g["bufferViews"][image["bufferView"]]
    at = view.get("byteOffset", 0)
    im = Image.open(io.BytesIO(blob[at : at + view["byteLength"]])).copy()
    return image["name"], im


class Package:
    def __init__(self, output, person):
        self.output = output
        self.person = person
        self.binary = bytearray()
        self.views = []
        self.acc = []
        self.buffers = [{}]
        self.shared = {}
        self.images = []
        self.textures = []
        self.image_map = {}
        self.materials = []
        self.meshes = []
        source_nodes = source("base_body")[0]["nodes"]
        self.nodes = deepcopy(source_nodes[:53])
        self.root = len(self.nodes)
        self.nodes.append(
            {
                "name": person["name"],
                "children": [52],
                "extras": {
                    "residentId": person["residentId"],
                    "personId": person["personId"],
                },
            }
        )

    def add_array(self, arr, kind, shared_key=None, bounds=False):
        arr = np.ascontiguousarray(arr)
        data = arr.tobytes()
        component = {"f": 5126, "B": 5121, "H": 5123, "I": 5125}[arr.dtype.char]
        if shared_key is None:
            self.binary.extend(bytes(-len(self.binary) % 4))
            offset = len(self.binary)
            self.binary.extend(data)
            buf = 0
        else:
            # Shared files are content-addressed so a new topology never invalidates
            # a published model or depends on a build's ordering.
            uri = (
                "../library/"
                + shared_key
                + "-"
                + hashlib.sha256(data).hexdigest()[:12]
                + ".bin"
            )
            if uri not in self.shared:
                store_shared(self.output, uri, data)
                self.shared[uri] = len(self.buffers)
                self.buffers.append({"uri": uri, "byteLength": len(data)})
            buf = self.shared[uri]
            offset = 0
        view = {"buffer": buf, "byteOffset": offset, "byteLength": len(data)}
        i = len(self.views)
        self.views.append(view)
        a = {
            "bufferView": i,
            "componentType": component,
            "count": len(arr),
            "type": kind,
        }
        if bounds:
            a.update(min=arr.min(axis=0).tolist(), max=arr.max(axis=0).tolist())
        self.acc.append(a)
        return len(self.acc) - 1

    def map_image(self, uri):
        if uri not in self.image_map:
            n = len(self.images)
            self.images.append({"uri": uri})
            self.textures.append({"source": n})
            self.image_map[uri] = n
        return self.image_map[uri]

    def finish(self, skin, weights):
        key = self.person["residentId"]
        skin = deepcopy(skin)
        skin["inverseBindMatrices"] = self.add_array(
            fit_skeleton(self.nodes, skin, weights), "MAT4"
        )
        self.buffers[0] = {"uri": key + ".bin", "byteLength": len(self.binary)}
        doc = {
            "asset": {"version": "2.0", "generator": "Asphalt Heat fitted street cast"},
            "scene": 0,
            "scenes": [{"nodes": [self.root]}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "skins": [skin],
            "images": self.images,
            "textures": self.textures,
            "buffers": self.buffers,
            "bufferViews": self.views,
            "accessors": self.acc,
        }
        publish(self.output / "cast" / (key + ".bin"), self.binary)
        publish(self.output / "cast" / (key + ".gltf"), encode(doc))


_SHARED = set()


def store_shared(output, uri, data):
    path = (output / "cast" / uri).resolve()
    if path not in _SHARED:
        publish(path, data)
        _SHARED.add(path)


@lru_cache(None)
def shared_texture(output, part, index):
    import io

    name, im = texture_image(part, index)
    im = im.copy()
    im.thumbnail((768, 768), Image.Resampling.LANCZOS)
    has_alpha = "A" in im.getbands()
    buf = io.BytesIO()
    im.save(buf, format="PNG" if has_alpha else "JPEG", quality=91)
    data = buf.getvalue()
    ext = ".png" if has_alpha else ".jpg"
    uri = "../library/" + name + "-" + hashlib.sha256(data).hexdigest()[:12] + ext
    store_shared(output, uri, data)
    return uri


def surface_texture(folder, part, index, colour, positions, eye_points):
    _, im = texture_image(part, index)
    size = 1024 if part == "base_body" else 384
    base = np.array(
        im.convert("RGB").resize((size, size), Image.Resampling.LANCZOS), "f"
    )
    pigment = np.array([int(colour[i : i + 2], 16) for i in (1, 3, 5)])
    base *= pigment / 210
    ys, xs, tri, weights, front = uv_pixels(part, size)
    surface = (positions[tri] * weights[:, :, None]).sum(1)
    if part == "base_body":
        tile = np.asarray(Image.open(folder / "face-colour.jpg").convert("RGB"))
        x, y, z = surface.T
        eyez = (eye_points[:, 1].max() + eye_points[:, 1].min()) * 0.5
        fw = np.ptp(eye_points[:, 0]) * 1.52
        u = (x / fw + 0.55) / 1.1
        v = 1 - ((y - eyez) / fw + 0.83) / 1.43
        blend = (
            front
            * np.clip((0.52 - abs(x) / fw) / 0.12, 0, 1)
            * np.clip(((y - eyez) / fw + 0.77) / 0.11, 0, 1)
            * np.clip((0.5 - (y - eyez) / fw) / 0.14, 0, 1)
            * np.clip((z - np.median(eye_points[:, 2]) + 0.063) / 0.047, 0, 1)
        )
    else:
        tile = np.asarray(Image.open(folder / "wardrobe-colour.jpg").convert("RGB"))
        mask = (
            np.asarray(Image.open(folder / "wardrobe-mask.png").convert("L"), "f") / 255
        )
        u = surface[:, 0] / 1.25 + 0.5
        v = 1 - surface[:, 1] / 1.72
        maskval = mask[
            np.clip(np.rint(v * (mask.shape[0] - 1)).astype(int), 0, mask.shape[0] - 1),
            np.clip(np.rint(u * (mask.shape[1] - 1)).astype(int), 0, mask.shape[1] - 1),
        ]
        blend = front * maskval * 0.87
    # OpenCV's remap has a 32767-pixel axis limit even for one-column maps.
    pixels = np.column_stack((u * (tile.shape[1] - 1), v * (tile.shape[0] - 1))).astype(
        "f"
    )
    samples = []
    for block in np.array_split(pixels, max(1, (len(pixels) + 25999) // 26000)):
        samples.append(
            cv2.remap(
                tile,
                block[:, None, :],
                None,
                cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )[:, 0, :]
        )
    base[ys, xs] = (
        base[ys, xs] * (1 - blend[:, None]) + np.concatenate(samples) * blend[:, None]
    )
    import io

    out = io.BytesIO()
    Image.fromarray(np.uint8(np.clip(base, 0, 255))).save(
        out, format="JPEG", quality=89
    )
    return out.getvalue()


def part_colour(part, label, colours, layers):
    if label == "Skin":
        return colours["Skin"]
    if part.startswith("hair_") or label == "Eyebrow":
        return colours["Hair"]
    if not part.startswith("clothing_"):
        return None
    if part in ("clothing_jeans", "clothing_shorts", "clothing_skirt"):
        return colours["Trousers"]
    if part in ("clothing_shoes", "clothing_boots"):
        return colours["Shoes"]
    if part == "clothing_tshirt" and any(
        x in layers for x in ("clothing_jacket", "clothing_trenchcoat")
    ):
        return colours["Undershirt"]
    return colours["Top"]


@lru_cache(None)
def topology_part(part, mesh_index, prim_index, top):
    g, _ = source(part)
    p = g["meshes"][mesh_index]["primitives"][prim_index]
    tri = accessor(part, p["indices"]).reshape(-1, 3)
    if part == "base_body" and mesh_index == 0:
        center = accessor(part, p["attributes"]["POSITION"])[tri].mean(1)
        # Keep the full neck, forearms for short sleeves, and all ten fingers.
        wrist = 0.317 if top in ("clothing_tshirt", "clothing_dress") else 0.409
        keep = (center[:, 1] > 1.38) | (abs(center[:, 0]) > wrist)
        tri = tri[keep]
    unique, ids = np.unique(tri, return_inverse=True)
    return unique, np.asarray(ids, "<u2").reshape(-1, 1)


def build(folder, output):
    person = json.loads((folder / "persona.json").read_text())
    fit = json.loads((folder / "photo-fit.json").read_text())
    layers, colours, weights = design(person, fit)
    base = source("base_body")[0]
    eye_mesh = next(m for m in base["meshes"] if m["name"] == "Eyes")
    eyes = morph("base_body", eye_mesh, eye_mesh["primitives"][0], weights)
    key = folder.name
    pkg = Package(output, person)
    top = next(x for x in layers if x.startswith("clothing_"))
    for part in ["base_body", *layers]:
        g, _ = source(part)
        materials = {}
        for mi, mesh in enumerate(g["meshes"]):
            if mesh["name"] in ("Teeth", "Tongue"):
                continue
            exported = []
            for pi, prim in enumerate(mesh["primitives"]):
                attrs = prim["attributes"]
                pos = morph(part, mesh, prim, weights)
                is_skin = mesh["name"] == "base"
                if is_skin:
                    sculpt_face(pos, eyes, folder, fit)
                norm = morph(part, mesh, prim, weights, "NORMAL")
                norm /= np.maximum(1e-8, np.linalg.norm(norm, axis=1)[:, None])
                ids, indices = topology_part(part, mi, pi, top)
                label = part.replace("clothing_", "") + "-" + str(mi) + "-" + str(pi)
                attr = {
                    "POSITION": pkg.add_array(
                        pos[ids].astype("<f4"), "VEC3", bounds=True
                    ),
                    "NORMAL": pkg.add_array(
                        norm[ids].astype("<f4"),
                        "VEC3",
                        None if is_skin else label + "-normal",
                    ),
                }
                for field, kind in [
                    ("TEXCOORD_0", "VEC2"),
                    ("JOINTS_0", "VEC4"),
                    ("WEIGHTS_0", "VEC4"),
                ]:
                    attr[field] = pkg.add_array(
                        accessor(part, attrs[field])[ids],
                        kind,
                        label + "-" + field.lower(),
                    )
                material_id = prim["material"]
                if material_id not in materials:
                    material = deepcopy(g["materials"][material_id])
                    material.pop("extras", None)
                    tone = part_colour(part, material["name"], colours, layers)
                    pbr = material["pbrMetallicRoughness"]
                    if tone:
                        pbr["baseColorFactor"] = linear_colour(tone)
                    for block in (material, pbr):
                        for name, val in block.items():
                            if not (name.endswith("Texture") and isinstance(val, dict)):
                                continue
                            texture_index = g["textures"][val["index"]]["source"]
                            fitted = (
                                is_skin
                                or (
                                    part.startswith("clothing_")
                                    and part not in ("clothing_shoes", "clothing_boots")
                                )
                            ) and name == "baseColorTexture"
                            if fitted:
                                uri = key + "-" + part + ".jpg"
                                publish(
                                    output / "cast" / uri,
                                    surface_texture(
                                        folder, part, texture_index, tone, pos, eyes
                                    ),
                                )
                                pbr["baseColorFactor"] = [1, 1, 1, 1]
                            else:
                                uri = shared_texture(output, part, texture_index)
                            val["index"] = pkg.map_image(uri)
                    materials[material_id] = len(pkg.materials)
                    pkg.materials.append(material)
                exported.append(
                    {
                        "attributes": attr,
                        "indices": pkg.add_array(
                            indices, "SCALAR", label + "-triangles"
                        ),
                        "material": materials[material_id],
                    }
                )
            pkg.nodes[pkg.root]["children"].append(len(pkg.nodes))
            pkg.nodes.append(
                {
                    "mesh": len(pkg.meshes),
                    "skin": 0,
                    "name": "Body" if mesh["name"] == "base" else mesh["name"],
                }
            )
            pkg.meshes.append({"name": mesh["name"], "primitives": exported})
    pkg.finish(base["skins"][0], weights)


def roster(output):
    rows = []
    for folder in sorted((ROOT / "Residents").glob("AH-R*")):
        p = json.loads((folder / "persona.json").read_text())
        row = {
            k: p[k]
            for k in (
                "residentId",
                "personId",
                "name",
                "occupation",
                "home",
                "voice",
                "agenda",
            )
        }
        row["model"] = (
            "ida-mercer.glb"
            if folder.name == "AH-R0001"
            else "cast/" + folder.name + ".gltf"
        )
        rows.append(row)
        if not (output / row["model"]).is_file():
            raise FileNotFoundError(output / row["model"])
    publish(output / "cast.json", encode(rows))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("output", type=Path)
    p.add_argument("ids", nargs="*")
    p.add_argument("--roster", action="store_true")
    args = p.parse_args()
    args.output = args.output.resolve()
    for sub in ("cast", "library"):
        (args.output / sub).mkdir(parents=True, exist_ok=True)
    cv2.setNumThreads(1)
    ids = args.ids or [
        str(f.name)
        for f in sorted((ROOT / "Residents").glob("AH-R*"))
        if f.name != "AH-R0001"
    ]
    for n, key in enumerate(ids, 1):
        if key != "AH-R0001":
            build(ROOT / "Residents" / key, args.output)
        if n % 50 == 0 or n == len(ids):
            print(f"{n}/{len(ids)} game models", flush=True)
    if args.roster:
        roster(args.output)
