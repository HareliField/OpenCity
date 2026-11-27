"""Audit published cast identity, native sources, skinning, texture paths and disk use."""

from pathlib import Path
from collections import Counter
import argparse
import hashlib
import json
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT.parent / "asphalt-heat/assets/residents"


def read(path):
    return json.loads(path.read_bytes())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit(keys, complete):
    rows = read(GAME / "cast.json")
    byid = {r["residentId"]: r for r in rows}
    assert len(rows) == len(byid) == len({r["personId"] for r in rows}) == 1500
    assert len([r for r in rows if r["personId"].startswith("ah-pd-")]) == 48
    photos = set()
    geometry = set()
    methods = Counter()
    merged = 0
    observed_hands = 0
    sizes = []
    for key in keys:
        f = ROOT / "Residents" / key
        row = byid[key]
        p = read(f / "persona.json")
        assert (
            p["personId"] == row["personId"]
            and len(p["reactions"]) == 3
            and p["voice"]
            and p["agenda"]
        )
        assert all(r in byid for r in p["familyIds"] + p["connectionIds"]), key
        sha = digest(f / "reference.jpg")
        assert (
            sha == read(f / "photo-fit.json")["referenceSha256"] and sha not in photos
        ), key
        photos.add(sha)
        method = (
            read(f / "casting.json").get("method")
            if (f / "casting.json").exists()
            else "Original studio"
        )
        methods[method] += 1
        if key == "AH-R0001":
            assert (GAME / "ida-mercer.glb").is_file() and (
                f / "character.blend"
            ).is_file()
            continue
        receipt = read(f / "manufacture.json")
        assert (
            receipt["reference"] == sha
            and digest(f / "character.blend") == receipt["blendSha256"]
            and receipt["masterCompression"] == 11
        ), key
        assert (f / "character.blend").stat().st_size == receipt["blendBytes"]
        raw = GAME / "cast" / (key + ".bin")
        sig = digest(raw)
        assert sig == receipt["geometrySha256"] and sig not in geometry, key
        geometry.add(sig)
        path = GAME / row["model"]
        g = read(path)
        native = read(f / "character.gltf")
        assert (
            g["asset"]["extras"]["reference"] == sha
            and g["asset"]["extras"]["factory"] == receipt["version"]
        )
        assert len(g["skins"]) == 1 and len(g["skins"][0]["joints"]) == 53
        names = [g["nodes"][i]["name"] for i in g["skins"][0]["joints"]]
        assert 30 == sum(
            n.startswith(("index_", "middle_", "pinky_", "ring_", "thumb_"))
            for n in names
        )
        for table in ("buffers", "images"):
            for live, source in zip(g[table], native[table], strict=True):
                dest = (path.parent / live["uri"]).resolve()
                assert dest.is_file() and dest == (f / source["uri"]).resolve(), (
                    key,
                    live["uri"],
                )
                if table == "buffers":
                    assert live["byteLength"] == dest.stat().st_size
        data = raw.read_bytes()

        def arr(i, dtype, width):
            a = g["accessors"][i]
            v = g["bufferViews"][a["bufferView"]]
            assert v["buffer"] == 0
            return np.frombuffer(
                data, dtype, count=a["count"] * width, offset=v.get("byteOffset", 0)
            ).reshape(-1, width)

        triangles = 0
        for m in g["meshes"]:
            for prim in m["primitives"]:
                at = prim["attributes"]
                pos = arr(at["POSITION"], "<f4", 3)
                wt = arr(at["WEIGHTS_0"], "uint8", 4)
                j = arr(at["JOINTS_0"], "uint8", 4)
                assert (
                    np.isfinite(pos).all()
                    and len(pos) == len(wt) == len(j)
                    and np.all(wt.sum(1) == 255)
                    and j.max() < 53
                ), key
                assert len(pos) < 65536 and np.max(np.abs(pos)) < 5, key
                triangles += g["accessors"][prim["indices"]]["count"] // 3
        observed_hands += len(read(f / "hand-fit.json")["sides"])
        merged += 1
        sizes.append(triangles)
        assert (GAME / "portraits" / (key + ".webp")).is_file(), key
    summary = {
        "audited": len(keys),
        "factoryModels": merged,
        "photoMethods": dict(methods),
        "observedHands": observed_hands,
        "triangles": ([min(sizes), int(np.median(sizes)), max(sizes)] if sizes else []),
    }
    if complete:
        assert len(keys) == 1500 and len(geometry) == 1499 and len(photos) == 1500
        bytes_used = sum(
            f.stat().st_size
            for d in (ROOT, GAME)
            for f in d.rglob("*")
            if f.is_file() and "__pycache__" not in f.parts
        )
        summary["residentSourceAndGameBytes"] = bytes_used
        assert bytes_used <= 5_000_000_000, bytes_used
    return summary


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("ids", nargs="*")
    a = cli.parse_args()
    keys = a.ids or [f"AH-R{i:04}" for i in range(1, 1501)]
    print(json.dumps(audit(keys, not a.ids), indent=2))
