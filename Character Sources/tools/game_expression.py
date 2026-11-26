"""Attach Ida's listening expression to her exported conversational take."""

import json
import struct
import numpy as np


def add_brow_performance(target, expression):
    data = target.read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    meta = json.loads(data[20 : 20 + size])
    body = bytearray(data[28 + size :])
    face = next(
        (i for i, n in enumerate(meta["nodes"]) if n.get("name") == "Measured face"),
        None,
    )
    if (
        not expression
        or face is None
        or not meta["meshes"][meta["nodes"][face]["mesh"]]["primitives"][0].get(
            "targets"
        )
    ):
        return meta

    def scalar(values):
        values = np.asarray(values, dtype="<f4")
        view = len(meta["bufferViews"])
        meta["bufferViews"].append(
            dict(buffer=0, byteOffset=len(body), byteLength=values.nbytes)
        )
        body.extend(values.tobytes())
        meta["accessors"].append(
            dict(
                bufferView=view,
                componentType=5126,
                count=len(values),
                type="SCALAR",
                min=[float(values.min())],
                max=[float(values.max())],
            )
        )
        return len(meta["accessors"]) - 1

    talk = next(a for a in meta["animations"] if a["name"] == "Talk")
    sampler = len(talk["samplers"])
    talk["samplers"].append(
        dict(
            input=scalar([p[0] for p in expression]),
            output=scalar([p[1] for p in expression]),
            interpolation="LINEAR",
        )
    )
    talk["channels"].append(
        dict(sampler=sampler, target=dict(node=face, path="weights"))
    )
    meta["buffers"][0]["byteLength"] = len(body)
    header = json.dumps(meta, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    target.write_bytes(
        struct.pack(
            "<4sIIII", b"glTF", 2, 28 + len(header) + len(body), len(header), 0x4E4F534A
        )
        + header
        + struct.pack("<II", len(body), 0x004E4942)
        + body
    )
    return meta
