"""Recompress native Blender seekable frames without changing any uncompressed scene bytes."""

import argparse
import ctypes
import ctypes.util
import hashlib
import json
import os
from pathlib import Path
import struct
import shutil
import tempfile
import time

library = ctypes.util.find_library("zstd")
if not library and shutil.which("zstd"):
    directory = Path(shutil.which("zstd")).resolve().parents[1] / "lib"
    library = next(
        (
            str(directory / i)
            for i in ("libzstd.dylib", "libzstd.so.1")
            if (directory / i).exists()
        ),
        None,
    )
ZSTD = ctypes.CDLL(library or "libzstd.so.1")
C = ctypes.c_size_t
for fn, types in [
    ("ZSTD_decompress", [ctypes.c_void_p, C, ctypes.c_void_p, C]),
    ("ZSTD_compress", [ctypes.c_void_p, C, ctypes.c_void_p, C, ctypes.c_int]),
    ("ZSTD_compressBound", [C]),
    ("ZSTD_isError", [C]),
]:
    func = getattr(ZSTD, fn)
    func.argtypes = types
    func.restype = C


def compress_frames(source, level=11):
    n, descriptor, magic = struct.unpack_from("<IBI", source, len(source) - 9)
    if magic != 0x8F92EAB1 or descriptor != 0:
        raise ValueError("Unexpected Blender compression header")
    start = len(source) - 9 - 8 * n
    frames = []
    table = []
    offset = 0
    for i in range(n):
        compressed, size = struct.unpack_from("<II", source, start + i * 8)
        block = source[offset : offset + compressed]
        offset += compressed
        plain = ctypes.create_string_buffer(size)
        decoded = ZSTD.ZSTD_decompress(plain, size, block, len(block))
        if ZSTD.ZSTD_isError(decoded) or decoded != size:
            raise ValueError("Invalid Blender frame")
        cap = ZSTD.ZSTD_compressBound(size)
        target = ctypes.create_string_buffer(cap)
        count = ZSTD.ZSTD_compress(target, cap, plain, size, level)
        if ZSTD.ZSTD_isError(count):
            raise ValueError("Scene compression failed")
        buf = target.raw[:count] if count < compressed else block
        frames.append(buf)
        table.append(struct.pack("<II", len(buf), size))
    footer = b"".join(table) + struct.pack("<IBI", n, 0, magic)
    return b"".join(frames) + struct.pack("<II", 0x184D2A5E, len(footer)) + footer


def replace(path, data):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        tmp.write(data)
        name = tmp.name
    os.chmod(name, 0o644)
    os.replace(name, path)


def compact(folder):
    receipt = folder / "manufacture.json"
    if not receipt.is_file():
        return False
    record = json.loads(receipt.read_text())
    if record.get("masterCompression") == 11:
        return True
    p = folder / "character.blend"
    compressed = compress_frames(p.read_bytes())
    replace(p, compressed)
    record.update(
        masterCompression=11,
        blendBytes=len(compressed),
        blendSha256=hashlib.sha256(compressed).hexdigest(),
    )
    replace(receipt, json.dumps(record, separators=(",", ":")).encode())
    return True


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("folders", nargs="*", type=Path)
    cli.add_argument("--follow", action="store_true")
    a = cli.parse_args()
    waiting = a.folders or sorted(
        f
        for f in (Path(__file__).resolve().parents[1] / "Residents").glob("AH-R*")
        if f.name != "AH-R0001"
    )
    while waiting:
        waiting = [f for f in waiting if not compact(f)]
        if not a.follow:
            break
        if waiting:
            time.sleep(2)
