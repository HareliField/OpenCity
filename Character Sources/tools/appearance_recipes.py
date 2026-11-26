"""Select complete authored treatments or keep the resident's own fitted reference.

The Wash House outfit includes the red thread, windbreaker, denim and jersey.
The Wash House groom includes the swept fringe, temple wisps and silver hoops.
A resident can request either treatment independently in their art direction.
"""

import json


OUTFIT_RECIPE = "wash-house-windbreaker-denim-jersey"
GROOM_RECIPE = "wash-house-side-swept-bun-and-hoops"


def use_wash_house_outfit(resident, art):
    if "wardrobeRecipe" in art:
        return art["wardrobeRecipe"] == OUTFIT_RECIPE
    return (
        resident == "AH-R0001"
        and art.get("outerwear") == "red gathered windbreaker with a folded hood"
    )


def use_wash_house_groom(resident, art):
    if "groomRecipe" in art:
        return art["groomRecipe"] == GROOM_RECIPE
    return (
        resident == "AH-R0001" and art.get("hair") == "loose bun with side-swept fringe"
    )


def surface_prefixes(resident, art, skin_reference):
    prefixes = (
        ["windbreaker", "denim", "jersey"]
        if use_wash_house_outfit(resident, art)
        else []
    )
    if skin_reference:
        prefixes.append("skin")
    return prefixes


def fitted_layers(folder, layers):
    art_file = folder / "art-direction.json"
    art = json.loads(art_file.read_text()) if art_file.is_file() else {}
    return wardrobe_layers(art, layers)


def wardrobe_layers(art, layers):
    if art.get("wardrobeRecipe") != OUTFIT_RECIPE:
        return layers
    # Keep the resident's hair and shoes, and fit the meshes used by this outfit.
    hair = [layer for layer in layers if layer.startswith("hair_")]
    shoes = [layer for layer in layers if layer in ("clothing_boots", "clothing_shoes")]
    return [*hair, "clothing_jacket", "clothing_tshirt", "clothing_jeans", *shoes]
