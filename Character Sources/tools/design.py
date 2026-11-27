"""Translate each authored portrait into editable anatomical targets and garments."""

import random

COLOURS = {
    "olive": "#74754c",
    "navy": "#283348",
    "dark green": "#365640",
    "red windbreaker": "#ac302f",
    "plum": "#674258",
    "mustard": "#b39146",
    "indigo": "#414c71",
    "pale blue": "#acc7d2",
    "denim": "#4c6681",
    "rust": "#9d5b3c",
    "black overshirt": "#353536",
    "bottle-green": "#345746",
    "tan jacket": "#b59c75",
    "cream": "#d7ccad",
    "sand-colored": "#b7a689",
    "gray fisher": "#8f9090",
    "soft blue": "#7799ae",
    "moss-green": "#66785b",
    "brown corduroy": "#7d533d",
    "narrow-striped": "#a09b91",
    "striped cotton": "#c2bbb1",
    "charcoal": "#505157",
    "violet": "#866e91",
}
HAIR = [
    ("braid", "braid01"),
    ("tightly coiled", "afro01"),
    ("curls", "afro01"),
    ("pinned", "ponytail01"),
    ("ponytail", "ponytail01"),
    ("center part", "long01"),
    ("fringe", "ponytail01"),
    ("streak running", "short04"),
    ("widow's peak", "short04"),
    ("cropped", "short02"),
    ("short", "short04"),
    ("close to", "short02"),
    ("waves", "bob01"),
]
RANGES = [
    "nose_width",
    "nose_length",
    "nose_height",
    "jaw_width",
    "chin",
    "cheekbones",
    "eye_size",
    "eye_spacing",
    "eye_tilt",
    "lips",
    "mouth_width",
    "ear_size",
    "forehead",
]
SKIN = [
    "#f0c9b4",
    "#ddab89",
    "#c89778",
    "#bb896a",
    "#ac785b",
    "#8b604b",
    "#714c3e",
    "#e3b59c",
]


def first_match(s, choices, default):
    return next((value for phrase, value in choices if phrase in s), default)


def signed(weights, feature, value, ends=("decr", "incr")):
    if abs(value) > 0.015:
        weights[feature + "_" + ends[value > 0]] = round(min(1, abs(value)), 4)


def design(person, fit=None):
    rng = random.Random(person["residentId"])
    s = person["appearance"].lower()
    age = person["age"]
    hair = first_match(
        s,
        HAIR,
        rng.choice(["short04", "short02", "bob01", "bob02", "ponytail01", "long01"]),
    )
    if (
        fit
        and "hairProfile" in fit
        and not any(k in s for k in ("braid", "ponytail", "pinned", "fringe", "coiled"))
    ):
        extent = fit["hairProfile"]["bottomBelowEyes"]
        hair = (
            "long01"
            if extent > 1.02
            else "bob01"
            if extent > 0.58
            else "short04"
            if extent < 0.31
            else hair
        )
    top = first_match(
        s,
        [
            ("coat", "trenchcoat"),
            ("jacket", "jacket"),
            ("windbreaker", "jacket"),
            ("shirt", "shirt"),
            ("cardigan", "jacket"),
            ("pullover", "hoodie"),
            ("sweater", "hoodie"),
            ("vest", "tshirt"),
            ("jersey", "tshirt"),
        ],
        "shirt",
    )
    tone = first_match(s, COLOURS.items(), "#7e8182")
    hair_tone = first_match(
        s,
        [
            ("silver", "#aba9a1"),
            ("gray", "#938f86"),
            ("copper", "#85513b"),
            ("sandy", "#a28b66"),
            ("chestnut", "#614031"),
            ("dark", "#3b3534"),
            ("brown", "#534135"),
        ],
        rng.choice(["#463b36", "#594636", "#796453", "#332c29", "#aa987f"]),
    )
    layers = ["hair_" + hair, "clothing_" + top]
    if top in ("jacket", "trenchcoat"):
        layers.append("clothing_tshirt")
    layers += ["clothing_jeans", "clothing_" + rng.choice(["shoes", "boots"])]
    face = {k: rng.uniform(-0.54, 0.54) for k in RANGES}
    for cue, k, v in [
        ("wide-set", "eye_spacing", 0.78),
        ("delicate jaw", "jaw_width", -0.74),
        ("prominent ears", "ear_size", 0.78),
        ("full cheeks", "cheekbones", 0.7),
        ("flat bridge", "nose_height", -0.78),
        ("heart-shaped", "chin", 0.57),
        ("wide mouth", "mouth_width", 0.8),
        ("long nose", "nose_length", 0.8),
    ]:
        if cue in s:
            face[k] = v
    weight = rng.uniform(-0.68, 0.7)
    frame = rng.uniform(-0.88, 0.86)
    colors = {
        "Skin": rng.choice(SKIN),
        "Hair": hair_tone,
        "Top": tone,
        "Undershirt": rng.choice(["#e3d9c9", "#aaa39b", "#515259"]),
        "Trousers": rng.choice(["#424d5e", "#57534b", "#34383a", "#647083"]),
        "Shoes": rng.choice(["#433e3a", "#544839", "#403f40"]),
    }
    if fit:
        face.update(fit["faceTargets"])
        colors.update(fit["colours"])
        weight = fit.get("bodyWeight", weight)
        frame = fit.get("bodyFrame", frame)
    weights = {}
    signed(weights, "gender", frame, ("female", "male"))
    signed(weights, "weight", weight, ("min", "max"))
    signed(weights, "muscle", rng.uniform(-0.4, 0.54), ("min", "max"))
    signed(weights, "height", rng.uniform(-0.48, 0.48), ("short", "tall"))
    if age < 21:
        weights["age_child"] = round(min(0.9, (21 - age) / 15), 4)
    if age > 32:
        weights["age_old"] = round(min(0.95, (age - 32) / 48), 4)
    for k, v in face.items():
        signed(weights, "face_" + k, v)
    return layers, colors, weights
