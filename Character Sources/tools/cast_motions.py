"""Pack the resident capture library once for world-space retargeting in the playable city."""

from pathlib import Path
import json
import argparse
import numpy as np
from scipy.spatial.transform import Rotation
from crowd_geometry import ROOT
from population_models import atomic

AXIS = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], "f")
# Source endpoints define the bone direction. Neutral arm bends and varied body proportions
# are resolved against the individual skeleton when the character is bound in the game.
MAPPING = [
    ("pelvis", "Hips", None),
    ("spine_01", "LowerBack", "Spine"),
    ("spine_02", "Spine", "Spine1"),
    ("spine_03", "Spine1", "Neck"),
    ("neck_01", "Neck1", "Head"),
    ("head", "Head", None),
]
for side, prefix in [("l", "Left"), ("r", "Right")]:
    for dst, a, b in [
        ("clavicle", "Shoulder", "Arm"),
        ("upperarm", "Arm", "ForeArm"),
        ("lowerarm", "ForeArm", "Hand"),
        ("hand", "Hand", "HandIndex1"),
        ("thigh", "UpLeg", "Leg"),
        ("calf", "Leg", "Foot"),
        ("foot", "Foot", "ToeBase"),
        ("ball", "ToeBase", "ToeBaseEnd"),
    ]:
        MAPPING.append((dst + "_" + side, prefix + a, prefix + b))
CUTS = {
    "get_up": (12, 106),
    "dodge": (17, 85),
    "wave": (28, 91),
    "explain": (214, 282),
    "hurt_walk": (22, 95),
    "lift_basket": (19, 47),
    "clean_window": (20, 90),
}


def build(out):
    library = ROOT / "Motion"
    catalog = json.loads((library / "catalog.json").read_text())
    result = {"bones": [k for k, _, _ in MAPPING], "clips": {}}
    blob = bytearray()
    for key in sorted(catalog):
        with np.load(library / (key + ".npz")) as t:
            names = list(t["names"])
            source = [names.index(start) for _, start, _ in MAPPING]
            rest = t["rest"] @ AXIS.T
            positions = t["positions"] @ AXIS.T
            a, b = CUTS.get(key, (0, len(positions)))
            s = np.arange(a, min(b, len(positions)), 2)
            if s[-1] != min(b, len(positions)) - 1:
                s = np.r_[s, min(b, len(positions)) - 1]
            ori = AXIS @ t["rotations"][s][:, source] @ AXIS.T
            q = (
                Rotation.from_matrix(ori.reshape(-1, 3, 3))
                .as_quat()
                .reshape(len(s), len(source), 4)
            )
            for i in range(1, len(q)):
                q[i, np.sum(q[i] * q[i - 1], axis=1) < 0] *= -1
            lengths = sum(
                np.linalg.norm(rest[names.index(b)] - rest[names.index(a)])
                for a, b in [("LeftUpLeg", "LeftLeg"), ("LeftLeg", "LeftFoot")]
            )
            floor = np.percentile(
                positions[
                    :, [names.index("LeftToeBase"), names.index("RightToeBase")], 1
                ].min(axis=1),
                2,
            )
            root = positions[s, names.index("Hips")].copy()
            root[:, [0, 2]] -= root[:1, [0, 2]]
            root[:, 1] -= floor
            root /= lengths
            basis = []
            for _, start, end in MAPPING:
                v = (
                    (rest[names.index(end)] - rest[names.index(start)])
                    if end
                    else np.zeros(3)
                )
                basis.append((v / max(1e-8, np.linalg.norm(v))).round(6).tolist())
            qoff = len(blob)
            blob.extend(np.int16(np.clip(q, -1, 1) * 32767).tobytes())
            roff = len(blob)
            blob.extend(np.asarray(root, "<f4").tobytes())
            result["clips"][key] = {
                "frames": len(s),
                "fps": 12,
                "q": qoff,
                "root": roff,
                "directions": basis,
                "trial": catalog[key]["trial"],
            }
    atomic(out / "motion-bank.bin", blob)
    atomic(out / "motion-bank.json", json.dumps(result, separators=(",", ":")).encode())


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("output", type=Path)
    build(ap.parse_args().output)
