"""Resample CMU's MotionBuilder BVH conversion into compact measured poses."""

import argparse, hashlib, json, math, urllib.request
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
REV = "09a07f54f3bbb58797325f009282d0b2048a2871"
CLIPS = {
    "walk_stop": ("16_33", "Slow walk and settle"),
    "idle_shift": ("139_02", "Shift weight"),
    "explain": ("18_08", "Explain with hands"),
    "point": ("139_25", "Give directions"),
    "lift_basket": ("143_13", "Pick up a laundry basket"),
    "clean_window": ("143_26", "Wash the window"),
    "sit_rise": ("143_18", "Sit down and stand up"),
    "climb_ladder": ("143_37", "Climb a ladder"),
    "step_back": ("143_39", "Walk backward"),
    "sidestep": ("143_40", "Move sideways"),
    "dodge": ("139_09", "Duck aside"),
    "get_up": ("139_16", "Get up from the ground"),
    "hurt_walk": ("139_19", "Favor one leg while walking"),
    "stumble": ("22_12", "Stumble and catch balance"),
    "start_run": ("143_03", "Accelerate into a run"),
    "run_stop": ("143_02", "Run and stop"),
    "jump": ("16_01", "Jump and land"),
    "turn_walk": ("69_29", "Round a corner"),
    "look_around": ("139_01", "Look around"),
    "wave": ("143_25", "Wave to a neighbor"),
    "stretch": ("143_30", "Stretch and yawn"),
    "step_over": ("143_14", "Step over an obstacle"),
}


def parse(data):
    hierarchy, motion = data.decode().replace("\r", "").split("MOTION", 1)
    lines = [l.strip() for l in hierarchy.splitlines() if l.strip()]
    nodes = []
    stack = []
    cursor = 0
    pending = None
    for l in lines:
        if l.startswith(("ROOT ", "JOINT ")) or l == "End Site":
            name = (
                l.split(" ", 1)[1]
                if l != "End Site"
                else nodes[stack[-1]]["name"] + "End"
            )
            pending = len(nodes)
            nodes.append(
                {
                    "name": name,
                    "parent": stack[-1] if stack else -1,
                    "offset": [0, 0, 0],
                    "channels": [],
                    "index": cursor,
                }
            )
        elif l == "{":
            stack.append(pending)
        elif l == "}":
            stack.pop()
        elif l.startswith("OFFSET "):
            nodes[stack[-1]]["offset"] = list(map(float, l.split()[1:]))
        elif l.startswith("CHANNELS "):
            ch = l.split()[2:]
            nodes[stack[-1]]["channels"] = ch
            nodes[stack[-1]]["index"] = cursor
            cursor += len(ch)
    text = motion.strip().splitlines()
    n = int(text[0].split(":")[1])
    dt = float(text[1].split(":")[1])
    raw = np.fromstring(" ".join(text[2:]), sep=" ").reshape(n, cursor)
    indices = np.clip(np.round(np.arange(1, n, 1 / (24 * dt))).astype(int), 1, n - 1)
    raw = raw[indices]
    n = len(raw)
    globals = []
    positions = []
    rest = []
    eye = np.broadcast_to(np.eye(3), (n, 3, 3))
    for i, node in enumerate(nodes):
        offset = np.broadcast_to(np.array(node["offset"]), (n, 3)).copy()
        rot = eye.copy()
        for j, ch in enumerate(node["channels"]):
            axis = "XYZ".index(ch[0])
            v = raw[:, node["index"] + j]
            if ch.endswith("position"):
                offset[:, axis] += v
            else:
                theta = np.radians(v)
                c = np.cos(theta)
                s = np.sin(theta)
                B = eye.copy()
                a = (axis + 1) % 3
                b = (axis + 2) % 3
                B[:, a, a] = B[:, b, b] = c
                B[:, a, b] = -s
                B[:, b, a] = s
                rot = rot @ B
        parent = node["parent"]
        if parent < 0:
            globals.append(rot)
            positions.append(offset)
            rest.append(np.array(node["offset"]))
        else:
            globals.append(globals[parent] @ rot)
            positions.append(
                positions[parent] + np.einsum("fij,fj->fi", globals[parent], offset)
            )
            rest.append(rest[parent] + node["offset"])
    names = [q["name"] for q in nodes]
    p = np.stack(positions, axis=1)
    r = np.stack(globals, axis=1)
    # MotionBuilder is Y-up and the resident faces Blender -Y.
    C = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
    rest = np.array(rest) @ C.T
    p = p @ C.T
    r = C @ r @ C.T
    across = p[0, names.index("LeftUpLeg")] - p[0, names.index("RightUpLeg")]
    angle = -math.atan2(across[1], across[0])
    a = math.cos(angle)
    b = math.sin(angle)
    yaw = np.array([[a, -b, 0], [b, a, 0], [0, 0, 1]])
    p = p @ yaw.T
    r = yaw @ r
    p[:, :, :2] -= p[0, 0, :2].copy()
    return names, rest.astype("f"), p.astype("f"), r.astype("f")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("cache", type=Path)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, (ident, title) in CLIPS.items():
        url = f"https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/{REV}/data/{int(ident.split('_')[0]):03d}/{ident}.bvh"
        path = args.cache / (ident + ".bvh")
        if not path.exists():
            path.write_bytes(urllib.request.urlopen(url, timeout=45).read())
        data = path.read_bytes()
        names, rest, positions, rotations = parse(data)
        np.savez_compressed(
            ROOT / "Motion" / (name + ".npz"),
            names=names,
            rest=rest,
            positions=positions,
            rotations=rotations,
        )
        manifest[name] = {
            "title": title,
            "trial": ident,
            "source": url,
            "sha256": hashlib.sha256(data).hexdigest(),
            "fps": 24,
            "frames": len(positions),
        }
    (ROOT / "Motion" / "catalog.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
