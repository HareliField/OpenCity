"""Bake the station's paint, aggregate flooring, carpet tile and acoustic panels."""
from pathlib import Path

import numpy as np
from PIL import Image

TEX = Path(__file__).resolve().parents[1] / "tex"
SIZE = 512
rng = np.random.default_rng(311)
y, x = np.mgrid[:SIZE, :SIZE]
photo = np.asarray(Image.open(TEX / "plaster_d.webp").convert("L").resize((SIZE, SIZE)), dtype=float)
grain = (photo - np.mean(photo)) / max(np.std(photo), 1)
grit = rng.normal(0, 1, (SIZE, SIZE))


def bake(name, rgb, relief):
    # Use wrapped differences so the tangent normals match at both tile boundaries.
    du = (np.roll(relief, -1, 1) - np.roll(relief, 1, 1)) / 2
    dv = (np.roll(relief, -1, 0) - np.roll(relief, 1, 0)) / 2
    normal = np.stack((-du, dv, np.ones_like(du)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    for suffix, data in (("d", rgb), ("n", (normal + 1) * 127.5)):
        img = Image.fromarray(np.clip(data, 0, 255).astype(np.uint8))
        img.save(TEX / f"hq-{name}_{suffix}.webp", quality=93, method=6)


paint = grain * 3.4 + grit * 1.3
bake("paint", np.array([197, 192, 178]) + paint[..., None], paint * .031)

# Alternating quarter-turn carpet squares show the change in nap at adjoining seams.
turn = ((x // 256 + y // 256) % 2) == 0
along = np.where(turn, x, y)
across = np.where(turn, y, x)
weft = np.sin(along * np.pi / 2) + .42 * np.sin(along * np.pi / 8 + across * np.pi / 128)
nap = np.where(turn, -2, 2) + weft * 4 + grit * 6.5 + grain * 4
seam = ((x % 256) < 2) | ((y % 256) < 2)
nap[seam] -= 9
bake("carpet", np.array([75, 89, 93]) + nap[..., None], nap * .035)

# Fine angular marble chips in a warm grey polished aggregate.
aggregate = np.array([152, 151, 139]) + (grain * 2.6 + grit * 2)[..., None]
chips = [[220, 213, 188], [181, 166, 146], [92, 100, 98], [122, 115, 108], [198, 201, 190]]
for i in range(9000):
    cx, cy = rng.integers(0, SIZE, 2)
    r = rng.choice([1, 2, 2, 3, 4])
    xx, yy = np.mgrid[-r:r + 1, -r:r + 1]
    irregular = ((xx + yy * .27) ** 2 / r ** 2 + yy ** 2 / (r * .72) ** 2) < .95
    ix, iy = (cx + xx[irregular]) % SIZE, (cy + yy[irregular]) % SIZE
    aggregate[iy, ix] = np.array(chips[i % len(chips)]) + grit[iy, ix, None] * 2
bake("aggregate", aggregate, grain * .03 + grit * .022)

mineral = grit * 1.9 + grain * 2.1
for _ in range(6200):
    cy, cx = rng.integers(0, SIZE, 2)
    length = rng.integers(1, 4)
    mineral[(cy + np.arange(length)) % SIZE, cx] -= rng.integers(12, 50)
bake("acoustic", np.array([190, 188, 174]) + mineral[..., None], mineral * .018)
