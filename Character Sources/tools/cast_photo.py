"""Synthesize an individual casting photo using a local stable-diffusion.cpp server."""

import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import random
import re
import urllib.request
from PIL import Image, ImageOps
from design import design

ROOT = Path(__file__).resolve().parents[1]


def costume(person):
    s = person["appearance"]
    hair = re.search(r"Look for (.+?)\.|with (.+?) that refuse to lie flat", s)
    features = (
        s.split("Usually dressed")[0]
        .split("On an ordinary day")[0]
        .split("In conversation")[0]
    )
    clothing = re.search(
        r"(?:dressed in|familiar outfit is|look for|favorite piece of clothing,) (?:a|an) (.{3,40}?)(?: with | and |\. |\.)",
        s,
        re.I,
    )
    clothes = (
        clothing[1]
        if clothing
        else next(
            (
                phrase
                for phrase in [
                    "knitted vest",
                    "shirt",
                    "sweater",
                    "coat",
                    "jacket",
                    "cardigan",
                    "windbreaker",
                    "jersey",
                ]
                if phrase in s
            ),
            "practical street clothes",
        )
    )
    desc = features + " " + (hair[1] or hair[2] if hair else "") + " " + s
    return clothes, desc


def studio_prompt(person):
    r = random.Random(person["residentId"])
    clothes, s = costume(person)
    s = s.lower()
    hair = next(
        (
            h
            for h in [
                "close-cropped dark curls",
                "cropped cut",
                "braid",
                "dark undercut",
                "sandy hair",
                "copper curls",
                "gray streak",
                "silver temples",
                "straight chestnut hair",
                "soft fringe",
                "uneven waves",
                "tightly coiled hair",
                "pinned away from the temples",
                "curls",
                "ponytail",
            ]
            if h in s
        ),
        "natural everyday haircut",
    )
    feature = next(
        (
            f
            for f in [
                "wide-set eyes",
                "expressive upper lip",
                "delicate jaw",
                "heart-shaped face",
                "full cheeks",
                "crooked front tooth",
                "prominent ears",
                "flat bridge",
                "dimples",
                "sharp cheekbones",
                "narrow face",
                "heavy brows",
            ]
            if f in s
        ),
        "distinctive facial proportions",
    )
    _, tones, weights = design(person)
    role = "woman" if "gender_female" in weights else "man"
    canonical = person["life"] + " " + person["voice"]
    if re.search(r"\b[Ss]he\b", canonical) and not re.search(r"\b[Hh]e\b", canonical):
        role = "woman"
    elif re.search(r"\b[Hh]e\b", canonical) and not re.search(r"\b[Ss]he\b", canonical):
        role = "man"
    complexions = [
        "light olive skin",
        "warm brown skin",
        "fair freckled skin",
        "medium brown skin",
        "dark brown skin",
        "light warm skin",
        "tan skin",
    ]
    body = r.choice(
        [
            "sturdy build",
            "lean build",
            "round shoulders",
            "compact build",
            "average build",
            "broad build",
        ]
    )
    affect = r.choice(
        [
            "calm attentive gaze",
            "small amused expression",
            "reserved expression",
            "thoughtful gaze",
            "patient expression",
        ]
    )
    return (
        f"Full length documentary casting photograph of one {person['age']} year old {role}, {feature}, {hair}, "
        f"{body}, {r.choice(complexions)}, {affect}. Wearing {clothes}, trousers and practical shoes. "
        "Standing facing camera, head to toe, arms down, hands clear of torso, shoe soles visible, centered upright, "
        "plain gray studio background, natural skin and fabric textures, softly lit realistic photograph."
    )


def synthesise(folder, pose, endpoint, seed, steps=6):
    person = json.loads((folder / "persona.json").read_text())
    out = folder / "reference.jpg"
    if out.exists():
        return
    img = ImageOps.fit(Image.open(pose).convert("RGB"), (448, 704))
    stream = io.BytesIO()
    img.save(stream, format="JPEG", quality=94)
    payload = {
        "prompt": studio_prompt(person),
        "negative_prompt": "illustration, painting, CGI, text, duplicate people, extra limbs, deformed hands, cropped head, cropped feet, glamour pose, bad anatomy",
        "init_images": [base64.b64encode(stream.getvalue()).decode()],
        "denoising_strength": 0.82,
        "width": 448,
        "height": 704,
        "steps": steps,
        "cfg_scale": 2.2,
        "sampler_name": "Euler a",
        "seed": seed,
    }
    req = urllib.request.Request(
        endpoint.rstrip("/") + "/sdapi/v1/img2img",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    raw = json.load(urllib.request.urlopen(req, timeout=200))
    picture = Image.open(io.BytesIO(base64.b64decode(raw["images"][0]))).convert("RGB")
    recovered = io.BytesIO()
    picture.save(recovered, format="JPEG", quality=94, subsampling=0)
    data = recovered.getvalue()
    # A higher-resolution independent capture may arrive while inference is running.
    if out.exists():
        return
    pending = folder / "local-reference.tmp"
    pending.write_bytes(data)
    pending.replace(out)
    receipt = {
        "method": "Local photo synthesis",
        "engine": "stable-diffusion.cpp",
        "model": "Realistic Vision V6.0 B1 Hyper",
        "seed": seed,
        "steps": steps,
        "poseSource": pose.parent.name,
        "prompt": payload["prompt"],
        "referenceSha256": hashlib.sha256(data).hexdigest(),
    }
    (folder / "casting.json").write_text(json.dumps(receipt, indent=2) + "\n")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("resident")
    p.add_argument("pose_source")
    p.add_argument("--server", default="http://127.0.0.1:19146")
    p.add_argument("--steps", type=int, default=6)
    a = p.parse_args()
    synthesise(
        ROOT / "Residents" / a.resident,
        ROOT / "Residents" / a.pose_source / "reference.jpg",
        a.server,
        760000 + int(a.resident[-4:]),
        a.steps,
    )
