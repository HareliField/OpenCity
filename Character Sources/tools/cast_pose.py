"""Register a 53-joint anatomical skeleton and its real surfaces to the standing casting camera."""

from copy import deepcopy
import json

import cv2
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation
from crowd_geometry import source, accessor, morph, fit_skeleton, topology
from design import design
from cast_direction import direction


def unit(v):
    return v / max(np.linalg.norm(v), 1e-8)


def align(a, b):
    x, y = unit(a), unit(b)
    axis = np.cross(x, y)
    mag = np.linalg.norm(axis)
    if mag < 1e-7:
        return (
            np.eye(3)
            if np.dot(x, y) >= 0
            else Rotation.from_rotvec(
                np.pi
                * unit(
                    np.cross(x, [1.0, 0.0, 0.0] if abs(x[0]) < 0.9 else [0.0, 1.0, 0.0])
                )
            ).as_matrix()
        )
    return Rotation.from_rotvec(axis / mag * np.arctan2(mag, np.dot(x, y))).as_matrix()


class CastingPose:
    def __init__(self, folder):
        self.folder = folder
        self.person = json.loads((folder / "persona.json").read_text())
        self.fit = json.loads((folder / "photo-fit.json").read_text())
        self.photo = np.asarray(Image.open(folder / "reference.jpg").convert("RGB"))
        self.mask = np.asarray(Image.open(folder / "subject-mask.png"))
        self.h, self.w = self.mask.shape
        self.rgb = cv2.resize(
            self.photo, (self.w, self.h), interpolation=cv2.INTER_AREA
        )
        self.hair_cue, self.coat_cue = direction(self.person)
        _, self.colours, self.weights = design(self.person, self.fit)
        self.marks = np.fromfile(folder / "face-sculpt.bin", "<f4").reshape(468, 3)
        base, _ = source("base_body")
        self.skin = deepcopy(base["skins"][0])
        self.nodes = deepcopy(base["nodes"][:53])
        self.joints = self.skin["joints"]
        self.j = {self.nodes[n]["name"]: i for i, n in enumerate(self.joints)}
        ib = (
            fit_skeleton(self.nodes, self.skin, self.weights)
            .reshape(-1, 4, 4)
            .transpose(0, 2, 1)
        )
        self.rest = np.linalg.inv(ib).astype("d")
        self.goal = self.rest.copy()
        self.bones = self.goal[:, :3, 3]
        self.base_body = morph(
            "base_body",
            base["meshes"][0],
            base["meshes"][0]["primitives"][0],
            self.weights,
        )
        eye = base["meshes"][3]
        self.base_eyes = morph("base_body", eye, eye["primitives"][0], self.weights)
        pupil = (self.base_eyes.min(0) + self.base_eyes.max(0)) * 0.5
        anchors = {k: np.array(v) for k, v in self.fit["bodyAnchors"].items()}
        # A cuff or shoe can be occluded. Complete the paired measurement from
        # the visible limb, otherwise project the preceding two joints at its length.
        for a, b in [("11", "12"), ("23", "24")]:
            if a not in anchors or b not in anchors:
                raise ValueError(f"{folder.name} lacks a measured torso")
        center_x = (anchors["23"][0] + anchors["24"][0]) * 0.5
        torso = np.linalg.norm(
            (anchors["11"] + anchors["12"] - anchors["23"] - anchors["24"]) * 0.5
        )
        for pair, parents, deltas in [
            ((13, 14), (11, 12), (0.055, 0.51)),
            ((15, 16), (13, 14), (0.015, 0.49)),
            ((25, 26), (23, 24), (0.012, 0.78)),
            ((27, 28), (25, 26), (0.008, 0.76)),
            ((31, 32), (27, 28), (0.018, 0.14)),
        ]:
            for side, k in enumerate(pair):
                if str(k) in anchors:
                    continue
                other = anchors.get(str(pair[1 - side]))
                sign = 1 - 2 * side
                anchors[str(k)] = (
                    np.array([2 * center_x - other[0], other[1]])
                    if other is not None
                    else anchors[str(parents[side])]
                    + torso * np.array([sign * deltas[0], deltas[1]])
                )
        foot = (anchors["27"] + anchors["28"]) / 2
        self.center = 0.5 * (foot[0] + (anchors["23"][0] + anchors["24"][0]) / 2)
        bounds = self.fit["subjectBounds"]
        height = float(np.ptp(self.base_body[:, 1]))
        if self.person["age"] < 18:
            height *= np.interp(self.person["age"], [10, 13, 17], [0.88, 0.93, 1.0])
        # A cropped source can still specify the head and shirt. Extrapolate its lower legs.
        self.floor = max(
            bounds[3], foot[1] + 0.046 * (anchors["27"][1] - anchors["11"][1])
        )
        self.metre = height / max(0.6, self.floor - bounds[1])
        self.ratio = self.w / self.h
        self.anchors = anchors
        self.face = self.to_world(self.marks[:, :2])
        eyes = self.face[[33, 263]].mean(0)
        self.span = np.linalg.norm(self.face[33] - self.face[263])
        head_scale = np.clip(
            self.span / max(1e-6, np.ptp(self.base_eyes[:, 0])), 0.69, 1.45
        )
        eye_depth = pupil[2]
        self.face[:, 2] = (
            eye_depth
            - (self.marks[:, 2] - self.marks[[33, 263], 2].mean())
            * self.metre
            * self.ratio
        )

        def pin(name, k, z_offset=0):
            i = self.j[name]
            xy = self.to_world(anchors[str(k)])
            self.bones[i, :2] = xy[:2]
            self.bones[i, 2] = self.rest[i, 2, 3] + z_offset

        for side, offset in [("l", 0), ("r", 1)]:
            for n, k, z in [
                ("upperarm", 11, 0.0),
                ("lowerarm", 13, -0.012),
                ("hand", 15, -0.080),
                ("thigh", 23, 0),
                ("calf", 25, 0.0),
                ("foot", 27, 0),
                ("ball", 31, 0.0),
            ]:
                pin(n + "_" + side, k + offset, z)
            foot_i = self.j["foot_" + side]
            ball = self.j["ball_" + side]
            self.bones[ball, 1] = max(0.01, min(0.039, self.bones[ball, 1]))
            # Pose landmarks sit on the shoe uppers. Keep the ankle joint at its natural height.
            self.bones[foot_i, 1] = np.clip(
                self.bones[foot_i, 1], self.bones[ball, 1] + 0.048, 0.16
            )
        hips = (self.at("thigh_l") + self.at("thigh_r")) / 2
        shoulders = (self.at("upperarm_l") + self.at("upperarm_r")) / 2
        pelvis = self.j["pelvis"]
        self.bones[pelvis, :2] = hips[:2] + [0, 0.009]
        n = self.j["neck_01"]
        chin = self.face[152]
        self.bones[n, :2] = [eyes[0], shoulders[1] + (chin[1] - shoulders[1]) * 0.53]
        head = self.j["head"]
        # Whole-head registration uses both eye corners, head tilt and chin length.
        head_roll = np.arctan2(
            self.face[263, 1] - self.face[33, 1], self.face[263, 0] - self.face[33, 0]
        )
        if abs(head_roll) > np.pi / 2:
            head_roll -= np.sign(head_roll) * np.pi
        face_rot = Rotation.from_rotvec([0, 0, head_roll]).as_matrix()
        self.face_linear = face_rot @ np.diag([head_scale, head_scale, head_scale])
        self.face_center = pupil
        self.eye_center = np.array([eyes[0], eyes[1], eye_depth])
        self.bones[head] = self.eye_center + self.face_linear @ (
            self.rest[head, :3, 3] - pupil
        )
        for key in ["spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r"]:
            i = self.j[key]
            b = self.rest[i, :3, 3]
            frac = (b[1] - self.rest[pelvis, 1, 3]) / (
                self.rest[n, 1, 3] - self.rest[pelvis, 1, 3]
            )
            self.bones[i, :2] = (
                self.bones[pelvis, :2] * (1 - frac) + self.bones[n, :2] * frac
            )
            self.bones[i, 0] += b[0]
        self.bones[self.j["Root"]] = self.rest[self.j["Root"], :3, 3]
        edges = {
            "pelvis": "spine_01",
            "spine_01": "spine_02",
            "spine_02": "spine_03",
            "spine_03": "neck_01",
            "neck_01": "head",
        }
        for side in ["l", "r"]:
            for a, b in [
                ("clavicle", "upperarm"),
                ("upperarm", "lowerarm"),
                ("lowerarm", "hand"),
                ("thigh", "calf"),
                ("calf", "foot"),
                ("foot", "ball"),
            ]:
                edges[a + "_" + side] = b + "_" + side
            hand = self.j["hand_" + side]
            f = self.j["middle_01_" + side]
            side_sign = 1 if side == "l" else -1
            R = align(
                self.rest[f, :3, 3] - self.rest[hand, :3, 3],
                np.array([-0.06 * side_sign, -1, 0.06]),
            )
            # The relaxed palms face the thigh. Fingers retain their native three segments and curl.
            for name, i in self.j.items():
                if name.endswith("_" + side) and name.split("_")[0] in (
                    "thumb",
                    "index",
                    "middle",
                    "ring",
                    "pinky",
                ):
                    self.bones[i] = self.bones[hand] + R @ (
                        self.rest[i, :3, 3] - self.rest[hand, :3, 3]
                    )
                    self.goal[i, :3, :3] = R @ self.rest[i, :3, :3]
            self.goal[hand, :3, :3] = R @ self.rest[hand, :3, :3]
        hand_path = folder / "hand-fit.json"
        detected = (
            json.loads(hand_path.read_text()).get("sides", {})
            if hand_path.exists()
            else {}
        )
        for side, marks in detected.items():
            raw = np.asarray(marks)
            measured = self.to_world(raw[:, :2])
            measured[:, 2] = (
                self.at("hand_" + side)[2]
                - (raw[:, 2] - raw[0, 2]) * self.metre * self.ratio
            )
            hand = self.j["hand_" + side]
            self.bones[hand] = measured[0]
            # Fit the palm plane from wrist, index knuckle and pinky knuckle before
            # posing three independently weighted phalanges of each observed digit.
            ids = [self.j["index_01_" + side], self.j["pinky_01_" + side]]
            source_dirs = [
                unit(self.rest[k, :3, 3] - self.rest[hand, :3, 3]) for k in ids
            ]
            target_dirs = [unit(measured[k] - measured[0]) for k in (5, 17)]
            R = Rotation.align_vectors(target_dirs, source_dirs)[0].as_matrix()
            self.goal[hand, :3, :3] = R @ self.rest[hand, :3, :3]
            for finger, start in [
                ("thumb", 1),
                ("index", 5),
                ("middle", 9),
                ("ring", 13),
                ("pinky", 17),
            ]:
                for k in range(3):
                    i = self.j[f"{finger}_0{k + 1}_{side}"]
                    self.bones[i] = measured[start + k]
                    orig = (
                        (
                            self.rest[self.j[f"{finger}_0{k + 2}_{side}"], :3, 3]
                            - self.rest[i, :3, 3]
                        )
                        if k < 2
                        else (
                            self.rest[i, :3, 3]
                            - self.rest[self.j[f"{finger}_02_{side}"], :3, 3]
                        )
                    )
                    self.goal[i, :3, :3] = (
                        align(R @ orig, measured[start + k + 1] - measured[start + k])
                        @ R
                        @ self.rest[i, :3, :3]
                    )
        for a, b in edges.items():
            i, k = self.j[a], self.j[b]
            self.goal[i, :3, :3] = (
                align(
                    self.rest[k, :3, 3] - self.rest[i, :3, 3],
                    self.bones[k] - self.bones[i],
                )
                @ self.rest[i, :3, :3]
            )
        self.goal[head, :3, :3] = face_rot @ self.rest[head, :3, :3]
        self.transform = self.goal @ np.linalg.inv(self.rest)
        par = {c: i for i, n in enumerate(self.nodes) for c in n.get("children", [])}
        slots = {n: i for i, n in enumerate(self.joints)}
        for i, n in enumerate(self.joints):
            parent = slots.get(par.get(n))
            m = (
                self.goal[i]
                if parent is None
                else np.linalg.solve(self.goal[parent], self.goal[i])
            )
            self.nodes[n]["translation"] = m[:3, 3].round(8).tolist()
            self.nodes[n]["rotation"] = (
                Rotation.from_matrix(m[:3, :3]).as_quat().round(9).tolist()
            )
            self.nodes[n].pop("scale", None)
        self.inverse = (
            np.linalg.inv(self.goal).transpose(0, 2, 1).astype("<f4").reshape(-1, 16)
        )
        self.face_depth = self.depth_grid()

    def at(self, name):
        return self.bones[self.j[name]]

    def to_world(self, xy):
        xy = np.asarray(xy)
        return np.stack(
            (
                (xy[..., 0] - self.center) * self.metre * self.ratio,
                (self.floor - xy[..., 1]) * self.metre,
                np.zeros_like(xy[..., 0]),
            ),
            axis=-1,
        )

    def uv(self, xyz):
        return np.stack(
            (
                xyz[..., 0] / (self.metre * self.ratio) + self.center,
                self.floor - xyz[..., 1] / self.metre,
            ),
            axis=-1,
        )

    def skin_geometry(self, part, mesh, prim):
        attrs = prim["attributes"]
        p = morph(part, mesh, prim, self.weights)
        n = morph(part, mesh, prim, self.weights, "NORMAL")
        ids = accessor(part, attrs["JOINTS_0"])
        w = accessor(part, attrs["WEIGHTS_0"])
        a = (self.transform[ids] * w[:, :, None, None]).sum(1)
        posed = np.einsum("nij,nj->ni", a[:, :3, :3], p) + a[:, :3, 3]
        normal = np.einsum("nij,nj->ni", a[:, :3, :3], n)
        head = (ids == self.j["head"]) * w
        ht = np.clip(head.sum(1), 0, 1)
        hp = (p - self.face_center) @ self.face_linear.T + self.eye_center
        posed += (hp - posed) * ht[:, None]
        return (
            posed,
            normal / np.maximum(1e-7, np.linalg.norm(normal, axis=1)[:, None]),
            ids,
            w,
        )

    def depth_grid(self):
        depth = np.zeros((self.h, self.w), "f")
        # Rasterize the measured face. Opaque backing follows this depth at every viewing angle.
        pts = self.marks[:, :2] * [self.w, self.h]
        for t in topology():
            q = pts[t]
            lo = np.maximum(0, np.floor(q.min(0)).astype(int))
            hi = np.minimum([self.w - 1, self.h - 1], np.ceil(q.max(0)).astype(int))
            if np.any(hi < lo):
                continue
            yy, xx = np.mgrid[lo[1] : hi[1] + 1, lo[0] : hi[0] + 1]
            m = (q[1:] - q[0]).T
            if abs(np.linalg.det(m)) < 1e-6:
                continue
            uv = np.stack((xx - q[0, 0], yy - q[0, 1]), -1) @ np.linalg.inv(m).T
            inside = (uv.min(-1) >= -0.018) & (uv.sum(-1) <= 1.018)
            zz = self.face[t[0], 2] + uv @ (self.face[t[1:], 2] - self.face[t[0], 2])
            depth[yy[inside], xx[inside]] = zz[inside]
        return depth
