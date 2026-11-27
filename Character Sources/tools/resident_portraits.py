"""Write compact, whole-person directory portraits from the approved source photograph."""

from pathlib import Path
import argparse
import io
import json
from PIL import Image, ImageOps
from crowd_geometry import ROOT
from population_models import atomic


def thumbnail(folder, dest):
    path = dest / (folder.name + ".webp")
    fit = folder / "photo-fit.json"
    source = folder / "reference.jpg"
    if not source.is_file() or not fit.is_file():
        return
    if path.is_file() and path.stat().st_mtime >= max(
        source.stat().st_mtime, fit.stat().st_mtime
    ):
        return
    im = Image.open(source).convert("RGB")
    record = json.loads(fit.read_bytes())
    if record.get("subjectBounds"):
        x0, y0, x1, y1 = record["subjectBounds"]
        w, h = im.size
        crop = (
            max(0, int((x0 - 0.025) * w)),
            max(0, int((y0 - 0.012) * h)),
            min(w, int((x1 + 0.025) * w)),
            min(h, int((y1 + 0.012) * h)),
        )
        im = im.crop(crop)
    im = ImageOps.pad(
        im, (264, 400), Image.Resampling.LANCZOS, color=im.getpixel((0, 0))
    )
    out = io.BytesIO()
    im.save(out, format="WEBP", quality=77, method=4)
    atomic(path, out.getvalue())


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("output", type=Path)
    a = p.parse_args()
    for f in sorted((ROOT / "Residents").glob("AH-R*")):
        thumbnail(f, a.output)
