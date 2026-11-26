"""Write the cast's searchable name-to-asset directory."""

from pathlib import Path
import json
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]


def directory():
    rows = [
        "# Asphalt Heat resident models",
        "",
        "Search by name, occupation or department ID. Each character folder holds the native Blender scene and the written persona. Photographic references and review renders appear in the same folder as fitting finishes.",
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
                "| Resident | Age | Work | Character sources |",
                "| --- | ---: | --- | --- |",
            ]
        )
        for p in batch:
            folder = "Residents/" + p["residentId"]
            name = p["name"] + (
                " · " + p["personId"] if p["personId"] != p["residentId"] else ""
            )
            story = "../asphalt-heat/" + quote(p["biography"], safe="/#")
            rows.append(
                f"| [{name}]({story}) | {p['age']} | {p['occupation']} | [Folder]({folder}) · [Blender]({folder}/character.blend) · [Persona]({folder}/persona.json) |"
            )
        rows.append("")
    (ROOT / "Directory.md").write_text("\n".join(rows).rstrip() + "\n")


if __name__ == "__main__":
    directory()
