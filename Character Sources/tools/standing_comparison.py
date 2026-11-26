"""Compare two packaged rigs to the original full-length photograph at one camera scale."""

import argparse
import json
from pathlib import Path

import mediapipe as mp
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def report(reference, versions, model_dir, output, city=None):
    size = (640, 960)
    original = (
        Image.open(reference).convert("RGB").resize(size, Image.Resampling.LANCZOS)
    )

    def matte_and_rgb(file):
        im = Image.open(file).convert("RGBA").resize(size, Image.Resampling.LANCZOS)
        return np.asarray(im)[:, :, 3] > 128, Image.alpha_composite(
            Image.new("RGBA", size, (176, 175, 173, 255)), im
        ).convert("RGB")

    rendered = [matte_and_rgb(path) for path in versions]
    v = mp.tasks.vision
    opts = v.ImageSegmenterOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(model_dir / "hair.tflite")
        ),
        output_category_mask=True,
        output_confidence_masks=False,
    )

    def parts(segmenter, pic):
        return (
            segmenter.segment(
                mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(pic))
            )
            .category_mask.numpy_view()
            .squeeze()
            .copy()
        )

    results = {}
    with v.ImageSegmenter.create_from_options(opts) as seg:
        target = parts(seg, original)
        for label, (matte, pic) in zip(("previous", "revised"), rendered):
            source = parts(seg, pic)
            metrics = {}
            for item, a, b in [
                ("wholeBody", target != 0, matte),
                ("hair", target == 1, source == 1),
                ("clothes", target == 4, source == 4),
            ]:
                inter = a & b
                union = a | b
                aa = np.float32(np.asarray(original)[inter])
                bb = np.float32(np.asarray(pic)[inter])
                metrics[item] = {
                    "silhouetteIoU": round(float(inter.sum() / union.sum()), 4),
                    "meanAbsoluteRgbError": round(float(abs(aa - bb).mean()), 2),
                }
            results[label] = metrics

    def strip(views, labels, filename):
        width, height = views[0].size
        result = Image.new("RGB", (width * len(views), height + 34), (35, 35, 35))
        draw = ImageDraw.Draw(result)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 17)
        except OSError:
            font = ImageFont.load_default()
        for i, (im, title) in enumerate(zip(views, labels)):
            result.paste(im, (i * width, 34))
            draw.text((i * width + 10, 8), title, font=font, fill="white")
        result.save(output / filename, quality=94)

    views = [original, rendered[0][1], rendered[1][1]]
    labels = [
        "Original casting photograph",
        "Earlier gameplay model",
        "Revised gameplay model",
    ]
    strip(
        [im.resize((400, 600), Image.Resampling.LANCZOS) for im in views],
        labels,
        "standing-comparison.jpg",
    )
    crop = (138, 5, 496, 466)
    strip([im.crop(crop) for im in views], labels, "clothing-and-hair.jpg")
    if city is not None:
        city_frame = Image.open(city).convert("RGB")
        strip(
            [
                im.resize((512, 768), Image.Resampling.LANCZOS)
                for im in (original, city_frame)
            ],
            ["Original casting photograph", "Ida standing in the Wash House"],
            "wash-house-comparison.jpg",
        )
    result = {
        "camera": "Single frontal orthographic casting camera, same Idle time and image scale for both game exports. RGB error uses overlapping semantic pixels in the neutral studio. 0 is an exact RGB match.",
        "measurements": results,
    }
    (output / "standing-comparison.json").write_text(
        json.dumps(result, indent=2) + "\n"
    )
    print(json.dumps(results))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("reference", type=Path)
    p.add_argument("previous", type=Path)
    p.add_argument("revised", type=Path)
    p.add_argument("models", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument(
        "--city",
        type=Path,
        help="Full-length frame captured by the Wash House standing camera",
    )
    a = p.parse_args()
    report(a.reference, [a.previous, a.revised], a.models, a.output, a.city)
