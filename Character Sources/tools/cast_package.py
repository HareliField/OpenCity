"""Standard glTF buffers, resident attributes and shared strand maps."""

from copy import deepcopy
from functools import lru_cache
import hashlib
import json
import os
import tempfile
import numpy as np
from PIL import Image

from crowd_geometry import source


def encode(data):
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()


def publish(path, content):
    if path.is_file() and path.read_bytes() == content:
        return
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as dest:
        dest.write(content)
        name = dest.name
    os.chmod(name, 0o644)
    os.replace(name, path)


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
