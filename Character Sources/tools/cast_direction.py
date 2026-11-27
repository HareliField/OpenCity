"""Resolve the visible haircut and outer garment specified in each authored appearance."""

HAIR = {
    "steel-colored hair cut square above the collar": (
        "bob01",
        "square cut above collar",
        "steel gray",
    ),
    "short black hair swept back": ("short04", "swept back", "black"),
    "black hair twisted into a small knot": (
        "ponytail01",
        "small twisted knot",
        "black",
    ),
    "dark brown curls cut close behind the ears": (
        "afro01",
        "close curls behind ears",
        "dark brown",
    ),
    "thick, tightly coiled hair": ("afro01", "dense tight coils", "unspecified"),
    "a center part and straight chestnut hair": (
        "long01",
        "straight centre part",
        "chestnut",
    ),
    "swept fringe and a closely clipped nape": (
        "short04",
        "fringe with clipped nape",
        "unspecified",
    ),
    "cropped cut that shows the shape of the ears": (
        "short02",
        "ear-revealing crop",
        "unspecified",
    ),
    "close-cropped dark curls": ("afro01", "short cropped curls", "dark"),
    "high puff tied with plain cord": ("afro01", "high tied puff", "unspecified"),
    "short copper curls": ("afro01", "short curls", "copper"),
    "blunt cut just below the ears": ("bob02", "blunt below-ear hem", "unspecified"),
    "dark undercut with a longer wave on top": (
        "short04",
        "undercut with raised top wave",
        "dark",
    ),
    "short sandy hair and a marked widow's peak": (
        "short04",
        "short with widow's peak",
        "sandy",
    ),
    "auburn hair cut square at the nape": ("bob01", "squared nape", "auburn"),
    "short, uneven waves that refuse to lie flat": (
        "bob01",
        "short uneven waves",
        "unspecified",
    ),
    "long plait tucked inside the collar": (
        "braid01",
        "collar-tucked long plait",
        "unspecified",
    ),
    "soft fringe that falls across one eyebrow": (
        "ponytail01",
        "asymmetric eyebrow-length fringe",
        "unspecified",
    ),
    "loose dark braid": ("braid01", "loose single braid", "dark"),
    "brown hair pinned away from the temples": (
        "ponytail01",
        "pinned, exposed temples",
        "brown",
    ),
    "silver temples and a dark fringe": (
        "short04",
        "fringe with two-tone temples",
        "silver temples and dark fringe",
    ),
    "smooth side part with one rebellious curl": (
        "short04",
        "smooth side part with loose curl",
        "unspecified",
    ),
    "gray streak running back from the forehead": (
        "short04",
        "front-to-back streak",
        "gray streak",
    ),
    "thin scattering of white hair over the crown": (
        "short02",
        "sparse crown",
        "white",
    ),
    "salt-and-pepper curls": ("afro01", "short curls", "salt and pepper"),
    "long silver braid": ("braid01", "long braid", "silver"),
    "silvery hair gathered at the nape": (
        "ponytail01",
        "low gathering at nape",
        "silver",
    ),
    "tightly curled gray hair": ("afro01", "tight curls", "gray"),
    "gray hair trimmed very close behind the ears": (
        "short02",
        "short behind ears",
        "gray",
    ),
    "neat white crop": ("short02", "neat crop", "white"),
    "two white streaks in otherwise dark hair": (
        "short04",
        "two contrasting streaks",
        "dark with two white streaks",
    ),
    "closely cropped salt-and-pepper hair": (
        "short02",
        "close crop",
        "salt and pepper",
    ),
    "iron-gray waves": ("bob01", "waves", "iron gray"),
    "short white hair and darker eyebrows": (
        "short04",
        "short, contrasting brows",
        "white hair with darker eyebrows",
    ),
    "soft white hair brushed sideways": ("short04", "brushed sideways", "white"),
}
OUTFITS = {
    "black overshirt with pearl buttons": ("shirt", "overshirt", "pearl buttons"),
    "rust-colored canvas coat": ("trenchcoat", "coat", "rust canvas"),
    "faded indigo overshirt": ("shirt", "overshirt", "faded indigo"),
    "gray fisher's sweater": (
        "hoodie",
        "crew-neck fisherman's sweater",
        "gray cable knit",
    ),
    "striped cotton shirt": ("shirt", "shirt", "striped cotton"),
    "narrow-striped sweater": (
        "hoodie",
        "sweater without a hood",
        "narrow-stripe knit",
    ),
    "soft blue checked shirt": ("shirt", "shirt", "blue check"),
    "mustard canvas overshirt": ("shirt", "overshirt", "mustard canvas"),
    "cream pullover": ("hoodie", "pullover without a hood", "cream knit"),
    "pale blue work shirt": ("shirt", "work shirt", "pale blue"),
    "red windbreaker": ("jacket", "work windbreaker", "red shell"),
    "charcoal zip cardigan": ("jacket", "zip-front cardigan", "charcoal knit"),
    "long navy raincoat": ("trenchcoat", "long raincoat", "navy shell"),
    "sand-colored linen shirt": ("shirt", "shirt", "sand linen"),
    "dark green knitted vest": ("tshirt", "sleeveless knitted vest", "dark green knit"),
    "brown corduroy jacket": ("jacket", "jacket", "brown corduroy"),
    "plum-colored cardigan": ("jacket", "cardigan", "plum knit"),
    "cropped bottle-green coat": ("trenchcoat", "cropped coat", "bottle green"),
    "olive canvas jacket": ("jacket", "jacket", "olive canvas"),
    "old plum windbreaker": ("jacket", "aged windbreaker", "faded plum shell"),
    "moss-green cardigan": ("jacket", "cardigan", "moss knit"),
    "unlined tan jacket": ("jacket", "unlined jacket", "tan shell"),
    "boxy denim jacket": ("jacket", "box-cut jacket", "denim"),
    "washed violet jersey": ("tshirt", "jersey", "washed violet"),
}


def longest(text, cues):
    return next(
        (cue for cue in sorted(cues, key=len, reverse=True) if cue in text), None
    )


def direction(person):
    text = person["appearance"].casefold()
    hair = longest(text, HAIR)
    outer = longest(text, OUTFITS)
    if not hair or not outer:
        raise ValueError(f"{person['residentId']} lacks specific casting direction")
    return hair, outer
