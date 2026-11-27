"""Write the cast's searchable name-to-asset directory."""

from pathlib import Path
import json
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]


def directory():
    rows = [
        "# Commonstreet resident models",
        "",
        "Select a name to read the story. Compare each person's casting photograph with a standing render from their Blender scene. In the game, open **Residents** to follow family connections and meet the person in the city.",
        "",
    ]
    people = [
        json.loads(p.read_text())
        for p in sorted((ROOT / "Residents").glob("AH-R*/persona.json"))
    ]
    for start in range(0, len(people), 150):
        batch = people[start : start + 150]
        rows.extend(
            [
                f"## {batch[0]['residentId']}–{batch[-1]['residentId']}",
                "",
                "| Resident | Age | Work | Compare | Character sources |",
                "| --- | ---: | --- | --- | --- |",
            ]
        )
        for p in batch:
            folder = "Residents/" + p["residentId"]
            name = p["name"] + (
                " · " + p["personId"] if p["personId"] != p["residentId"] else ""
            )
            story = "../commonstreet/" + quote(p["biography"], safe="/#")
            standing = (
                f"../commonstreet/assets/residents/standing/{p['residentId']}.webp"
            )
            rows.append(
                f"| [{name}]({story}) | {p['age']} | {p['occupation']} "
                f"| [Photo]({folder}/reference.jpg) · [Standing model]({standing}) "
                f"| [Folder]({folder}) · [Blender]({folder}/character.blend) · [Persona]({folder}/persona.json) |"
            )
        rows.append("")
    (ROOT / "Directory.md").write_text("\n".join(rows).rstrip() + "\n")


if __name__ == "__main__":
    directory()
