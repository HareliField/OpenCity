"""Compile the authored biographies into individual character assets."""

import json
import re
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1]
GAME = SOURCE.parent / "asphalt-heat"
BIOGRAPHIES = GAME / "stories" / "residents"

ANCHOR = re.compile(r'<a id="(ah-r\d{4})"></a>\s*\n## ([^\n]+)\n\n')
LINK = re.compile(r"\[([^\]]+)\]\(([^)]*)#(ah-r\d{4})\)")


def section(body, label):
    match = re.search(r"^\*\*" + re.escape(label) + r"\.\*\* (.+)$", body, re.M)
    if not match:
        raise ValueError(f"Missing section {label}")
    return match[1]


def unlinked(value):
    return LINK.sub(lambda m: m[1], value)


def read_cast():
    cast = {}
    for story in sorted(BIOGRAPHIES.glob("[0-9][0-9]/[0-9][0-9]-*.md")):
        text = story.read_text()
        title = text.splitlines()[0].removeprefix("# ")
        opening = ANCHOR.split(text)
        if len(opening) != 31:
            raise ValueError(f"{story} must contain ten portraits")
        for key, name, body in zip(opening[1::3], opening[2::3], opening[3::3]):
            resident_id = key.upper()
            if resident_id in cast:
                raise ValueError(f"Duplicate resident {resident_id}")
            identity = body.splitlines()[0].split(" · ")
            if len(identity) < 4 or identity[0] != resident_id:
                raise ValueError(f"Inconsistent identity for {name}")
            person_id = next(
                (
                    s.removeprefix("Department ID ")
                    for s in identity
                    if s.startswith("Department ID ")
                ),
                resident_id,
            )
            relationships = {
                label: section(body, label)
                for label in ("Family", "People in this story")
            }
            reactions = []
            for line in body.split("**Under pressure**", 1)[1].strip().splitlines():
                if not line.startswith("- "):
                    continue
                reaction = line[2:]
                trigger, separator, response = reaction.partition(". ")
                if not separator:
                    trigger, separator, response = reaction.partition(", ")
                if not separator:
                    raise ValueError(f"Unrecognized reaction for {resident_id}")
                reactions.append(
                    {"situation": trigger, "response": response, "asWritten": reaction}
                )
            if len(reactions) != 3:
                raise ValueError(f"Expected three reactions for {resident_id}")
            agenda = re.search(r"^\*\*What [^\n]*? wants\.\*\* (.+)$", body, re.M)[1]
            cast[resident_id] = {
                "residentId": resident_id,
                "personId": person_id,
                "name": name,
                "age": int(identity[1].removeprefix("Age ")),
                "occupation": identity[2],
                "home": identity[3].removeprefix("Home — "),
                "episode": title,
                "biography": story.relative_to(GAME).as_posix() + "#" + key,
                "life": section(body, "Life in the city"),
                "voice": section(body, "In their own words").strip("“”"),
                "appearance": section(body, "Appearance"),
                "personality": section(body, "Personality"),
                "agenda": agenda,
                "family": unlinked(relationships["Family"]),
                "connections": unlinked(relationships["People in this story"]),
                "familyIds": [
                    m[3].upper() for m in LINK.finditer(relationships["Family"])
                ],
                "connectionIds": [
                    m[3].upper()
                    for m in LINK.finditer(relationships["People in this story"])
                ],
                "reactions": reactions,
            }
    for person in cast.values():
        for other in person["familyIds"] + person["connectionIds"]:
            if other not in cast:
                raise ValueError(f"Unknown relationship {other}")
    if len(cast) != 1500 or len({p["personId"] for p in cast.values()}) != len(cast):
        raise ValueError("Invalid roster")
    return cast


if __name__ == "__main__":
    cast = read_cast()
    for resident_id, person in cast.items():
        path = SOURCE / "Residents" / resident_id / "persona.json"
        path.parent.mkdir(exist_ok=True, parents=True)
        encoded = json.dumps(person, ensure_ascii=False, indent=2) + "\n"
        if not path.exists() or path.read_text() != encoded:
            path.write_text(encoded)
    print(f"Compiled {len(cast)} individual personas")
