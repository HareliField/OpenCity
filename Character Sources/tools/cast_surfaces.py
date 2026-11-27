"""Build closed, skinned garment sections and a cranial groom in the casting camera."""

from functools import lru_cache
import io

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d
from cast_direction import HAIR
from crowd_geometry import source, accessor, topology

REGIONS = ("skin", "hair", "shirt", "trousers", "shoe")
SWATCH = {
    "skin": "Skin",
    "hair": "Hair",
    "shirt": "Top",
    "trousers": "Trousers",
    "shoe": "Shoes",
}
RHEIGHT = 144


def rgb(hexcode):
    return np.array([int(hexcode[i : i + 2], 16) for i in (1, 3, 5)], dtype="f")


class Surfaces:
    def __init__(self, pose):
        self.p = pose
        w, h = pose.w, pose.h
        self.land = {int(k): np.array(v) * [w, h] for k, v in pose.anchors.items()}
        self.jaw = int(pose.marks[152, 1] * h)
        self.hips = (self.land[23] + self.land[24]) * 0.5
        self.shoulders = (self.land[11] + self.land[12]) * 0.5
        self.eyes = pose.marks[[33, 263], :2].mean(0) * [w, h]
        self.face_width = max(12, np.ptp(pose.marks[:, 0]) * w)
        self.hem = self.garment_hem()
        self.safe_front = {}
        y, x = np.mgrid[:h, :w]
        dx = self.face_width
        region = pose.mask > 0
        self.region = region
        self.roi = {
            "skin": np.isin(pose.mask, [2, 3]),
            "hair": (pose.mask == 1)
            & (y < self.jaw + dx * 2.3)
            & (abs(x - self.eyes[0]) < dx * 1.25),
            "shirt": (pose.mask == 4) & (y < self.hem + 4),
            "trousers": (pose.mask == 4) & (y >= self.hem - 4),
            "shoe": region & (y > min(self.land[27][1], self.land[28][1]) + 0.005 * h),
        }
        self.y = y
        self.x = x
        self.luma = cv2.cvtColor(pose.rgb, cv2.COLOR_RGB2GRAY).astype("f")
        self.fold = self.luma - cv2.GaussianBlur(self.luma, (0, 0), max(2, h * 0.009))
        self.make_atlas()
        self.parts = []

    def garment_hem(self):
        p = self.p
        h, w = p.h, p.w
        hip = int(self.hips[1])
        shoulders = int(self.shoulders[1])
        torso = max(20, hip - shoulders)
        a = max(shoulders + 4, hip - int(0.19 * torso))
        b = min(h - 5, hip + int(0.40 * torso))
        if b <= a + 4:
            return min(h - 3, max(shoulders + 5, hip))
        cx = int(self.hips[0])
        span = max(8, int(abs(self.land[23][0] - self.land[24][0]) * 0.64))
        patch = cv2.cvtColor(p.rgb, cv2.COLOR_RGB2LAB).astype("f")[
            a - 3 : b + 4, max(0, cx - span) : min(w, cx + span)
        ]
        change = np.median(np.linalg.norm(patch[6:] - patch[:-6], axis=2), axis=1)
        if not change.size:
            return hip
        bias = np.exp(
            -(((np.arange(len(change)) + a - hip) / max(10, 0.30 * torso)) ** 2)
        )
        return a + int(np.argmax(gaussian_filter1d(change, 1.3) * (0.35 + 0.65 * bias)))

    def make_atlas(self):
        p = self.p
        # Crop the backdrop out of the texture budget; retain portrait resolution.
        x0, y0, x1, y1 = p.fit["subjectBounds"]
        self.crop = np.array(
            [
                max(0, x0 - 0.016),
                max(0, y0 - 0.008),
                min(1, x1 + 0.016),
                min(1, y1 + 0.008),
            ]
        )
        x0, y0, x1, y1 = self.crop
        ph, pw = p.photo.shape[:2]
        self.ah = min(1400, max(600, int((y1 - y0) * ph)))
        self.aw = max(
            300, min(1024, round(self.ah * (x1 - x0) * pw / ((y1 - y0) * ph)))
        )
        iy, ix = round(y0 * ph), round(x0 * pw)
        photo = p.photo[
            iy : max(iy + 1, round(y1 * ph)), ix : max(ix + 1, round(x1 * pw))
        ]
        front = cv2.resize(photo, (self.aw, self.ah), interpolation=cv2.INTER_AREA)
        mask = cv2.resize(
            np.uint8(self.region), (pw, ph), interpolation=cv2.INTER_NEAREST
        )
        mask = cv2.resize(
            mask[iy : iy + photo.shape[0], ix : ix + photo.shape[1]],
            (self.aw, self.ah),
            interpolation=cv2.INTER_NEAREST,
        )
        # Pad photographed albedo into unused texels to eliminate studio-colour fringes at oblique angles.
        dist, nearest = cv2.distanceTransformWithLabels(
            1 - mask, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
        )
        edge = (mask == 0) & (dist < 11)
        cmap = np.zeros((nearest.max() + 1, 3), "uint8")
        cmap[nearest[mask > 0]] = front[mask > 0]
        front[edge] = cmap[nearest[edge]]
        atlas = np.zeros((self.ah + RHEIGHT, self.aw, 3), "uint8")
        atlas[: self.ah] = front
        self.swatches = {}
        for i, kind in enumerate(REGIONS):
            q = self.roi[kind].copy()
            if kind == "skin":
                q &= self.y < self.jaw
            if kind == "shirt":
                q &= (self.y > self.shoulders[1] + p.h * 0.04) & (
                    self.y < self.hem - p.h * 0.035
                )
            if kind == "trousers":
                q &= (self.y > self.hem + p.h * 0.05) & (self.y < self.land[25][1])
            tone = rgb(
                p.fit["colours"].get(
                    SWATCH[kind], p.colours.get(SWATCH[kind], "#66615e")
                )
            )
            # Sample a patch of the appropriate photographed material. Keep weave and
            # subtle shade gradients while removing frontal closures and facial features.
            if q.any():
                d = cv2.distanceTransform(q.astype("uint8"), cv2.DIST_L2, 5)
                err = np.linalg.norm(p.rgb.astype("f") - tone, axis=2)
                score = np.minimum(d, 18) * 2.5 - np.minimum(err, 150) * 0.25
                score[~q] = -1000
                cy, cx = np.unravel_index(np.argmax(score), q.shape)
                radius = max(1, min(18, int(d[cy, cx] * 0.60)))
                patch = p.rgb[
                    max(0, cy - radius) : cy + radius + 1,
                    max(0, cx - radius) : cx + radius + 1,
                ].astype("f")
                tone = np.median(patch.reshape(-1, 3), axis=0)
            else:
                patch = tone[None, None]
            left = i * self.aw // len(REGIONS)
            right = (i + 1) * self.aw // len(REGIONS)
            yy, xx = np.mgrid[:RHEIGHT, : right - left]
            noise = (
                np.sin(xx * 0.84 + np.sin(yy * 0.05)) * 0.9
                + np.sin(yy * 1.57 - xx * 0.47) * 0.75
            )
            if kind == "hair":
                noise = 5 * np.sin(xx * 0.77 + 4 * np.sin(yy * 0.042)) + 3 * np.sin(
                    xx * 2.11 + yy * 0.04
                )
            mirrored = np.concatenate([patch, patch[:, ::-1]], axis=1)
            mirrored = np.concatenate([mirrored, mirrored[::-1]], axis=0)
            repeat = np.tile(
                mirrored,
                (
                    1 + RHEIGHT // mirrored.shape[0],
                    1 + (right - left) // mirrored.shape[1],
                    1,
                ),
            )
            rear = (
                tone
                + (repeat[:RHEIGHT, : right - left] - tone)
                * (0.21 if kind == "skin" else 0.65)
                + noise[:, :, None]
            )
            atlas[self.ah :, left:right] = np.uint8(np.clip(rear, 0, 255))
            self.swatches[kind] = (left + 2, right - 2)
        memory = io.BytesIO()
        Image.fromarray(atlas).save(
            memory, format="JPEG", quality=88, subsampling=0, optimize=True
        )
        self.texture = memory.getvalue()

    def front_uv(self, pos):
        uv = self.p.uv(pos)
        x0, y0, x1, y1 = self.crop
        return np.stack(
            (
                np.clip((uv[:, 0] - x0) / (x1 - x0), 0.001, 0.999),
                np.clip((uv[:, 1] - y0) / (y1 - y0), 0.001, 0.999)
                * self.ah
                / (self.ah + RHEIGHT),
            ),
            axis=1,
        )

    def cloth_uv(self, points, kind):
        p = self.p
        if kind not in self.safe_front:
            permitted = self.roi[kind].copy()
            if kind == "shirt":
                # Include a neckline and an undershirt within the actual neckline.
                permitted |= (
                    (p.mask == 2)
                    & (self.y > self.jaw)
                    & (self.y < self.shoulders[1] + self.face_width * 0.2)
                    & (abs(self.x - self.eyes[0]) < self.face_width * 0.48)
                )
            if not permitted.any():
                return self.front_uv(points)
            _, labels = cv2.distanceTransformWithLabels(
                np.uint8(~permitted), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
            )
            lookup = np.zeros((labels.max() + 1, 2), "f")
            yy, xx = np.where(permitted)
            lookup[labels[yy, xx]] = np.stack((xx, yy), axis=1)
            self.safe_front[kind] = lookup[labels]
        grid = self.safe_front[kind]
        uv = p.uv(points)
        xx = np.clip(np.rint(uv[:, 0] * p.w).astype(int), 0, p.w - 1)
        yy = np.clip(np.rint(uv[:, 1] * p.h).astype(int), 0, p.h - 1)
        uv = np.clip(uv + (grid[yy, xx] - np.stack((xx, yy), 1)) / [p.w, p.h], 0, 1)
        return self.front_uv(p.to_world(uv))

    def rear_uv(self, kind, u, v):
        l, r = self.swatches[kind]
        return np.stack(
            (
                (l + (r - l) * np.clip(u, 0, 1)) / self.aw,
                (self.ah + 2 + (RHEIGHT - 4) * np.clip(v, 0, 1)) / (self.ah + RHEIGHT),
            ),
            axis=1,
        )

    def smooth_binding(self, y, names, levels):
        """Blend across the adjacent articulating joints along a garment panel."""
        order = np.argsort(levels)
        lv = np.asarray(levels)[order]
        ids = np.array([self.p.j[k] for k in names])[order]
        joint = np.zeros((len(y), 4), "uint8")
        weight = np.zeros((len(y), 4), "f")
        if len(ids) == 1:
            joint[:, 0] = ids[0]
            weight[:, 0] = 1
            return joint, weight
        lower = np.clip(np.searchsorted(lv, y) - 1, 0, len(lv) - 2)
        upper = lower + 1
        a = np.clip((y - lv[lower]) / np.maximum(0.1, lv[upper] - lv[lower]), 0, 1)
        a = a * a * (3 - 2 * a)
        joint[:, :2] = np.stack((ids[lower], ids[upper]), 1)
        weight[:, :2] = np.stack((1 - a, a), 1)
        return joint, weight

    def section(
        self,
        label,
        kind,
        y,
        lo,
        hi,
        cz,
        depth,
        names,
        levels,
        fold=0.003,
        ellipticity=1,
    ):
        p = self.p
        rows = len(y)
        columns = 19
        # Two semicircular surfaces share identical seam positions and normals,
        # but carry separate texture coordinates for observed and inferred cloth.
        theta = np.r_[
            np.linspace(-np.pi / 2, np.pi / 2, columns),
            np.linspace(np.pi / 2, 3 * np.pi / 2, columns),
        ]
        sin = np.sin(theta)[None, :]
        cos = np.cos(theta)[None, :]
        gx = (lo + hi)[:, None] / 2 + (hi - lo)[:, None] * 0.5 * sin
        gy = np.broadcast_to(np.asarray(y)[:, None], gx.shape)
        pos = p.to_world(np.stack((gx / p.w, gy / p.h), -1))
        pixel = (
            np.clip(gy.astype(int), 0, p.h - 1),
            np.clip(gx.astype(int), 0, p.w - 1),
        )
        crest = np.clip(self.fold[pixel] / 36, -1, 1) * fold
        c = np.sign(cos) * np.abs(cos) ** ellipticity
        pos[:, :, 2] = (
            np.asarray(cz)[:, None] + (np.asarray(depth)[:, None] + crest) * c
        )
        ring = pos[:, :columns]
        back = pos[:, columns:]

        def normals(q):
            along = np.gradient(q, axis=0)
            around = np.gradient(q, axis=1)
            out = np.cross(along, around)
            return out / np.maximum(1e-9, np.linalg.norm(out, axis=2)[:, :, None])

        n1, n2 = normals(ring), normals(back)
        for a, b in [(0, -1), (-1, 0)]:
            n1[:, a] = n2[:, b] = (n1[:, a] + n2[:, b]) * 0.5
        norm = np.concatenate((n1, n2), axis=1).reshape(-1, 3)
        points = pos.reshape(-1, 3)
        ncol = 2 * columns
        uv = (
            self.cloth_uv(points, kind)
            if kind in ("shirt", "shoe", "trousers")
            else self.front_uv(points)
        ).reshape(rows, ncol, 2)
        u = np.broadcast_to(
            np.linspace(0, 1, columns)[None, :], (rows, columns)
        ).ravel()
        v = np.broadcast_to(np.linspace(0, 1, rows)[:, None], (rows, columns)).ravel()
        uv[:, columns:] = self.rear_uv(kind, u, v).reshape(rows, columns, 2)
        joints, weights = self.smooth_binding(gy.ravel(), names, levels)
        indices = section_triangles(rows, columns)
        shapes = {}
        if label.startswith("Coat"):
            amount = (
                np.clip(
                    (gy.ravel() - np.quantile(gy, 0.78)) / max(1, np.ptp(gy) * 0.22),
                    0,
                    1,
                )
                ** 2
            )
            side = np.zeros_like(points)
            side[:, 0] = 0.006 * amount
            drag = np.zeros_like(points)
            drag[:, 2] = 0.005 * amount
            shapes = {"Hem side": side, "Hem drag": drag}
        elif label.startswith("Sleeve"):
            band = np.exp(
                -(((gy.ravel() - np.mean(levels)) / max(1, np.ptp(gy) * 0.11)) ** 2)
            )
            shapes = {"Sleeve fold " + label[-1]: norm * (band * 0.003)[:, None]}
        self.parts.append(
            (
                label,
                kind,
                points,
                norm,
                uv.reshape(-1, 2),
                joints,
                weights,
                indices,
                shapes,
            )
        )

    def intervals(self, mask, start, stop, center, radius, rows=40, span=False):
        p = self.p
        y = np.linspace(start, max(start + 3, stop), rows)
        limits = []
        center = np.broadcast_to(center(y), y.shape)
        radius = np.broadcast_to(radius(y), y.shape)
        for yy, c, r in zip(y, center, radius):
            ix = np.flatnonzero(
                mask[int(np.clip(round(yy), 0, p.h - 1))]
                & (np.abs(np.arange(p.w) - c) <= r)
            )
            if ix.size >= 2:
                runs = np.split(ix, np.flatnonzero(np.diff(ix) > 2) + 1)
                run = (
                    ix
                    if span
                    else min(
                        runs,
                        key=lambda a: (
                            max(a[0] - c, c - a[-1], 0)
                            + 0.04 * abs((a[0] + a[-1]) * 0.5 - c)
                        ),
                    )
                )
                limits.append([run[0] - 0.4, run[-1] + 0.4])
            else:
                limits.append([np.nan, np.nan])
        lo, hi = np.array(limits).T
        valid = np.isfinite(lo) & (hi - lo > 2)
        if valid.any():
            lo = np.interp(y, y[valid], lo[valid])
            hi = np.interp(y, y[valid], hi[valid])
        else:
            lo = center - radius * 0.57
            hi = center + radius * 0.57
        lo = gaussian_filter1d(lo, 0.65, mode="nearest")
        hi = gaussian_filter1d(hi, 0.65, mode="nearest")
        return y, lo, np.maximum(lo + 1.5, hi)

    def garments(self):
        p = self.p
        h, w = p.h, p.w
        lx = self.land
        sw = abs(lx[11][0] - lx[12][0])
        sy = self.shoulders[1]
        hip = self.hips[1]
        collar_rows = np.where(
            self.roi["shirt"]
            & (self.y > self.jaw - 2)
            & (np.abs(self.x - self.eyes[0]) < sw * 0.3)
        )[0]
        neck = max(
            self.jaw + 1,
            float(collar_rows.min()) if collar_rows.size else sy - h * 0.035,
        )
        neck = min(neck, sy - 2)

        # Radii between anatomy landmarks separate sleeves from torso where both touch.
        def arm_center(side, ys):
            q = np.array([lx[n + side] for n in (11, 13, 15)])
            return np.interp(ys, q[:, 1], q[:, 0])

        def torso_bounds(ys):
            e = abs(sw)
            ycap = (
                np.interp(
                    ys,
                    [neck, sy - 2, sy + h * 0.055, hip, self.hem + 2],
                    [0.23, 0.52, 0.47, 0.49, 0.47],
                )
                * e
            )
            return np.maximum(ycap, e * 0.18)

        y, lo, hi = self.intervals(
            self.roi["shirt"],
            neck,
            self.hem + 1,
            lambda a: np.interp(
                a, [neck, sy, hip], [self.eyes[0], self.shoulders[0], self.hips[0]]
            ),
            torso_bounds,
            42,
            span=True,
        )
        body_depth = np.clip((hi - lo) * p.metre * p.ratio / p.w * 0.39, 0.048, 0.155)
        cz = np.interp(
            y,
            [neck, sy, hip],
            [p.at("neck_01")[2] - 0.008, p.at("spine_03")[2], p.at("pelvis")[2]],
        )
        body_names = ["spine_03", "spine_02", "spine_01", "pelvis"]
        levels = [sy, 0.66 * sy + 0.34 * hip, 0.32 * sy + 0.68 * hip, hip]
        self.section(
            "Coat • " + p.coat_cue,
            "shirt",
            y,
            lo,
            hi,
            cz,
            body_depth,
            body_names,
            levels,
            0.005,
            0.78,
        )
        for i, side in enumerate(("l", "r")):
            shoulder, elbow, wrist = [lx[k + i] for k in (11, 13, 15)]

            def ac(a):
                return arm_center(i, a)

            def ar(a):
                return sw * np.interp(a, [sy, elbow[1], wrist[1]], [0.21, 0.165, 0.14])

            shoulder_start = shoulder[1] - min(sw * 0.13, h * 0.019)
            cuff = wrist[1] + h * 0.006
            sample = np.arange(int(elbow[1]), min(h, int(wrist[1] + h * 0.02)))
            if len(sample):
                xp = np.clip(ac(sample).astype(int), 0, w - 1)
                shirt = gaussian_filter1d(
                    np.float32(p.mask[sample, xp] == 4), max(1, h * 0.004)
                )
                valid = np.flatnonzero(shirt > 0.5)
                if valid.size:
                    cuff = min(cuff, sample[valid[-1]] + 2)
                elif np.sum(p.mask[sample, xp] == 2) > len(sample) * 0.65:
                    cuff = elbow[1] - h * 0.035
            sleeve = (p.mask == 4) & (self.y <= cuff + 1)
            a, b, c = self.intervals(sleeve, shoulder_start, cuff, ac, ar, 31)
            # A curved, low-profile shoulder cap joins the bodice over the acromion.
            cap = np.clip(
                (a - shoulder_start)
                / max(3, (shoulder[1] + h * 0.023) - shoulder_start),
                0,
                1,
            )
            shoulder_axis = np.clip(ac(a), b, c)
            b = shoulder_axis + (b - shoulder_axis) * (0.12 + 0.88 * np.sqrt(cap))
            c = shoulder_axis + (c - shoulder_axis) * (0.12 + 0.88 * np.sqrt(cap))
            radius = np.clip((c - b) * p.metre * p.ratio / p.w * 0.46, 0.025, 0.085)
            # The shoulder cap climbs toward the neck as it turns around the deltoid.
            cz = np.interp(
                a,
                [shoulder[1], elbow[1], wrist[1]],
                [
                    p.at("upperarm_" + side)[2],
                    p.at("lowerarm_" + side)[2],
                    p.at("hand_" + side)[2],
                ],
            )
            self.section(
                "Sleeve " + side,
                "shirt",
                a,
                b,
                c,
                cz,
                radius,
                ["upperarm_" + side, "lowerarm_" + side],
                [elbow[1] - h * 0.025, elbow[1] + h * 0.036],
                0.003,
            )
            hipxy, knee, ankle, toe = [lx[k + i] for k in (23, 25, 27, 31)]

            def lc(v):
                return np.interp(
                    v,
                    [hipxy[1], knee[1], ankle[1], toe[1]],
                    [hipxy[0], knee[0], ankle[0], toe[0]],
                )

            gap = abs(lx[23][0] - lx[24][0])

            def lr(v):
                return np.interp(
                    v, [hipxy[1], knee[1], ankle[1]], [gap * 0.94, sw * 0.31, sw * 0.27]
                )

            leg = (p.mask == 4) | (p.mask == 2)
            mid = np.interp(
                np.arange(h),
                [hip, (lx[25][1] + lx[26][1]) * 0.5, (lx[27][1] + lx[28][1]) * 0.5],
                [
                    self.hips[0],
                    (lx[25][0] + lx[26][0]) * 0.5,
                    (lx[27][0] + lx[28][0]) * 0.5,
                ],
            )
            leg &= (
                self.x >= mid[:, None] - 1
                if side == "l"
                else self.x <= mid[:, None] + 1
            )
            mid_cuff = np.clip(ankle[1] + h * 0.012, self.hem + 5, h - 2)
            leg &= ~((p.mask == 2) & (self.y < knee[1] - h * 0.06))
            # Exclude adjacent sleeves and hands from a trouser leg even if the arm overlaps the hip.
            lateral = np.interp(
                np.arange(h),
                [self.hem, hip + h * 0.09, knee[1]],
                [gap * 0.93, gap * 0.96, gap * 1.25],
            )
            leg &= abs(self.x - mid[:, None]) < lateral[:, None]
            a, b, c = self.intervals(leg, self.hem - 2, mid_cuff, lc, lr, 40)
            radius = np.clip(
                (c - b)
                * p.metre
                * p.ratio
                / p.w
                * np.interp(a, [hip, knee[1], ankle[1]], [0.60, 0.50, 0.41]),
                0.025,
                0.135,
            )
            z = np.interp(
                a,
                [hip, knee[1], ankle[1]],
                [
                    p.at("thigh_" + side)[2],
                    p.at("calf_" + side)[2],
                    p.at("foot_" + side)[2],
                ],
            )
            self.section(
                "Trouser leg " + side,
                "trousers",
                a,
                b,
                c,
                z,
                radius,
                ["pelvis", "thigh_" + side, "calf_" + side],
                [hip - h * 0.012, hip + h * 0.06, knee[1] + h * 0.022],
                0.004,
            )
            sole_ys = np.where(
                self.region
                & (self.y > mid_cuff - h * 0.02)
                & (abs(self.x - lc(self.y)) < sw * 0.32)
            )[0]
            floor = (
                min(h - 0.5, sole_ys.max() + 0.45)
                if sole_ys.size
                else toe[1] + h * 0.01
            )
            a, b, c = self.intervals(
                self.region, mid_cuff - h * 0.014, floor, lc, lambda v: sw * 0.31, 19
            )
            t = (a - a[0]) / max(1, a[-1] - a[0])
            z = p.at("foot_" + side)[2] + 0.048 * t
            radius = 0.040 + 0.068 * np.sin(np.pi * t * 0.74) ** 1.25
            self.section(
                "Shoe " + side,
                "shoe",
                a,
                b,
                c,
                z,
                radius,
                ["foot_" + side, "ball_" + side],
                [ankle[1] + h * 0.012, toe[1]],
                0.001,
                0.70,
            )

    def face(self):
        p = self.p
        t = topology().copy()
        v = p.face.copy()
        # Fill the ocular apertures with curved corneal surfaces that use the resident's observed irises.
        loops = [
            [
                33,
                7,
                163,
                144,
                145,
                153,
                154,
                155,
                133,
                173,
                157,
                158,
                159,
                160,
                161,
                246,
            ],
            [
                263,
                249,
                390,
                373,
                374,
                380,
                381,
                382,
                362,
                398,
                384,
                385,
                386,
                387,
                388,
                466,
            ],
        ]
        for loop in loops:
            center = v[loop].mean(0)
            center[2] += 0.0018
            c = len(v)
            v = np.vstack((v, center))
            t = np.vstack(
                (t, np.column_stack((loop, np.roll(loop, -1), np.full(len(loop), c))))
            )
        # Canonical face topology is anterior-oriented in camera space.
        if (
            np.median(np.cross(v[t[:, 1]] - v[t[:, 0]], v[t[:, 2]] - v[t[:, 0]])[:, 2])
            < 0
        ):
            t = t[:, ::-1]
        n = vertex_normals(v, t)
        j = np.zeros((len(v), 4), "uint8")
        j[:, 0] = p.j["head"]
        wt = np.zeros(j.shape, "f")
        wt[:, 0] = 1
        blink = np.zeros_like(v)
        speak = np.zeros_like(v)
        for upper, lower in [
            ([246, 161, 160, 159, 158, 157, 173], [7, 163, 144, 145, 153, 154, 155]),
            ([466, 388, 387, 386, 385, 384, 398], [249, 390, 373, 374, 380, 381, 382]),
        ]:
            blink[upper] = (v[lower] - v[upper]) * 0.95
        for k in [17, 14, 87, 178, 88, 95, 317, 402, 318, 324, 152, 175, 377, 148]:
            speak[k, 1] -= 0.004 if k in (152, 175, 377, 148) else 0.003
        self.parts.append(
            (
                "Face and corneas",
                "skin",
                v,
                n,
                self.front_uv(v),
                j,
                wt,
                t,
                {"Blink": blink, "Speak": speak},
            )
        )

    def anatomy(self):
        from scipy.ndimage import distance_transform_edt

        depth = self.p.face_depth.copy()
        hull = np.zeros(depth.shape, "uint8")
        cv2.fillConvexPoly(
            hull,
            cv2.convexHull(np.int32(self.p.marks[:, :2] * [self.p.w, self.p.h])),
            1,
        )
        _, near = distance_transform_edt(depth == 0, return_indices=True)
        fill = (hull > 0) & (depth == 0)
        depth[fill] = depth[near[0, fill], near[1, fill]]
        p = self.p
        g, _ = source("base_body")
        # Preserve native ears, full cranium, neck, palms, ten articulated digits and mouth interiors.
        for mi, mesh in enumerate(g["meshes"]):
            if mesh["name"] not in ("base", "Teeth", "Tongue", "Eyes"):
                continue
            for prim in mesh["primitives"]:
                v, n, j, wt = p.skin_geometry("base_body", mesh, prim)
                t = accessor("base_body", prim["indices"]).reshape(-1, 3)
                q = p.uv(v)
                px = np.clip((q[:, 0] * p.w).astype(int), 0, p.w - 1)
                py = np.clip((q[:, 1] * p.h).astype(int), 0, p.h - 1)
                head = np.isin(j, [p.j["head"], p.j["neck_01"]]).astype("f") * wt
                hands = [
                    i
                    for name, i in p.j.items()
                    if name.startswith(
                        (
                            "hand_",
                            "thumb_",
                            "index_",
                            "middle_",
                            "ring_",
                            "pinky_",
                            "lowerarm_",
                        )
                    )
                ]
                hand = (np.isin(j, hands) * wt).sum(1)
                if mesh["name"] == "base":
                    keep = (head.sum(1) > 0.13) | (hand > 0.18)
                    t = t[np.count_nonzero(keep[t], axis=1) >= 2]
                    dg = depth[py, px]
                    face = (dg != 0) & (head.sum(1) > 0.27) & (n[:, 2] > -0.15)
                    v[face, 2] = np.minimum(v[face, 2], dg[face] - 0.0016)
                    # Covered forearms stay inside the photographed sleeve.
                    for side in ["l", "r"]:
                        lower = p.at("lowerarm_" + side)
                        wrist = p.at("hand_" + side)
                        a = np.clip(
                            (v[:, 1] - wrist[1]) / max(0.01, lower[1] - wrist[1]), 0, 1
                        )
                        axis = wrist[None, :] + a[:, None] * (lower - wrist)
                        strength = (
                            np.clip((v[:, 1] - wrist[1] - 0.003) / 0.025, 0, 1)
                            * (p.mask[py, px] != 2)
                            * (np.abs(v[:, 0] - axis[:, 0]) < 0.11)
                            * (hand > 0.2)
                        )
                        v[:, [0, 2]] += (axis[:, [0, 2]] - v[:, [0, 2]]) * (
                            strength * 0.36
                        )[:, None]
                dg = depth[py, px]
                interior = (dg != 0) & (head.sum(1) > 0.25)
                if mesh["name"] in ("Eyes", "Teeth", "Tongue"):
                    # The fitted corneas and lips own the observed anterior surface.
                    v[interior, 2] = np.minimum(v[interior, 2], dg[interior] - 0.009)
                uv = self.cloth_uv(v, "skin")
                back = self.rear_uv(
                    "skin",
                    (np.sin(v[:, 0] * 45) + 1) * 0.5,
                    (np.sin(v[:, 1] * 27) + 1) * 0.5,
                )
                use = (n[:, 2] > 0.15) & np.isin(p.mask[py, px], [2, 3])
                if mesh["name"] == "base":
                    # Suppress disconnected chest/shoulder triangles beneath the collar.
                    neckrad = p.span * 0.72
                    neckarea = (np.abs(v[:, 0] - p.at("neck_01")[0]) < neckrad) | (
                        v[:, 1] > p.face[152, 1] - 0.01
                    )
                    visible = (hand > 0.23) | ((head.sum(1) > 0.27) & neckarea)
                    t = t[np.count_nonzero(visible[t], axis=1) >= 2]
                if mesh["name"] != "base":
                    use[:] = False
                uv[~use] = back[~use]
                if mesh["name"] == "base":
                    handskin = (hand > 0.4) & (head.sum(1) < 0.1)
                    # Occluded finger sides use local skin albedo; their UVs must never pick up a cuff or hip.
                    uv[handskin & ((~use) | (p.mask[py, px] != 2))] = back[
                        handskin & ((~use) | (p.mask[py, px] != 2))
                    ]
                ids, ind = np.unique(t, return_inverse=True)
                # The casting face supplies the detailed anterior surface. Weld tiny
                # native triangles in hidden mouth and cranium areas while preserving separate digits.
                tolerance = (
                    0.002
                    if mesh["name"] == "base"
                    else (0.0028 if mesh["name"] == "Eyes" else 0.0038)
                )
                selected = v[ids]
                groups = np.column_stack(
                    (
                        np.rint(selected / tolerance),
                        np.argmax(wt[ids], axis=1) * 0
                        + j[ids][np.arange(len(ids)), np.argmax(wt[ids], axis=1)],
                        np.sign(n[ids, 2])
                        if mesh["name"] == "base"
                        else np.zeros(len(ids)),
                    )
                )
                _, first, weld = np.unique(
                    groups, axis=0, return_index=True, return_inverse=True
                )
                ind = weld[ind].reshape(-1, 3)
                ind = ind[
                    (ind[:, 0] != ind[:, 1])
                    & (ind[:, 0] != ind[:, 2])
                    & (ind[:, 1] != ind[:, 2])
                ]
                ids = ids[first]
                if len(ids):
                    self.parts.append(
                        (
                            "Body" if mesh["name"] == "base" else mesh["name"],
                            "skin",
                            v[ids],
                            n[ids],
                            uv[ids],
                            j[ids],
                            wt[ids],
                            ind.reshape(-1, 3),
                            {},
                        )
                    )

    def groom(self):
        p = self.p
        hair = self.roi["hair"]
        yy, xx = np.nonzero(hair)
        if len(yy) < 8:
            return
        fw = self.face_width
        top = max(0, yy.min() - 0.5)
        bottom = min(p.h - 1, yy.max() + 0.5)
        cx = self.eyes[0]
        ey = self.eyes[1]
        # Fit the covered rear skull to the actual crown and temples, with its own relief and texture.
        y = np.linspace(top, max(top + 3, min(bottom, self.jaw + fw * 0.32)), 31)
        width = fw * 0.55
        crown_y = top + max(fw * 0.66, (ey - top) * 0.96)
        radius = width * np.sqrt(
            np.maximum(0.025, 1 - ((y - crown_y) / max(fw * 0.8, crown_y - top)) ** 2)
        )
        for k, sy in enumerate(y):
            inds = np.flatnonzero(hair[int(sy)])
            if inds.size and sy < ey + fw * 0.3:
                radius[k] = np.clip(
                    max(abs(inds[0] - cx), abs(inds[-1] - cx)), fw * 0.08, fw * 0.78
                )
        radius = gaussian_filter1d(radius, 0.9, mode="nearest")
        headz = p.at("head")[2]
        rx = width * p.metre * p.ratio / p.w
        cz = headz - 0.009
        ntheta = 29
        th = np.linspace(np.pi / 2, 3 * np.pi / 2, ntheta)
        xx = cx + radius[:, None] * np.sin(th)[None, :]
        ys = np.broadcast_to(y[:, None], xx.shape)
        v = p.to_world(np.stack((xx / p.w, ys / p.h), -1))
        cranial = np.sqrt(
            np.maximum(0.035, 1 - ((y - crown_y) / max(crown_y - top, fw * 0.85)) ** 2)
        )
        v[:, :, 2] = cz + cranial[:, None] * rx * 1.39 * np.cos(th)[None, :]
        indices = grid_triangles(len(y), ntheta)
        vf = v.reshape(-1, 3)
        n = vertex_normals(vf, indices)
        uv = self.rear_uv(
            "hair",
            np.tile(np.linspace(0, 1, ntheta), len(y)),
            np.repeat(np.linspace(0, 1, len(y)), ntheta),
        )
        j = np.zeros((len(vf), 4), "uint8")
        j[:, 0] = p.j["head"]
        wt = np.zeros(j.shape, "f")
        wt[:, 0] = 1
        self.parts.append(
            ("Rear scalp and groom", "hair", vf, n, uv, j, wt, indices, {})
        )
        # The front is a curved scalp and locks, tessellated against the actual hairline.
        # Dense boundary sampling follows the forehead, gaps near the ears and loose ends.
        from scipy.spatial import Delaunay

        loops, _ = cv2.findContours(
            np.uint8(hair), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE
        )
        edge = [c[:, 0, :][:: max(1, len(c) // 240)] for c in loops if len(c) > 5]
        gy, gx = np.where(
            hair
            & (self.y % max(2, int(fw / 18)) == 0)
            & (self.x % max(2, int(fw / 18)) == 0)
        )
        if not edge:
            return
        pixel = np.unique(np.concatenate([np.stack((gx, gy), 1), *edge]), axis=0)
        if len(pixel) < 4 or np.linalg.matrix_rank(pixel - pixel.mean(0)) < 2:
            return
        tri = Delaunay(pixel).simplices.copy()
        samples = (
            np.concatenate(
                [
                    pixel[tri].mean(1)[:, None, :],
                    (pixel[tri] + np.roll(pixel[tri], 1, axis=1)) * 0.5,
                ],
                axis=1,
            )
            .round()
            .astype(int)
        )
        tri = tri[np.all(hair[samples[:, :, 1], samples[:, :, 0]], axis=1)]
        if not len(tri):
            return
        x, y = pixel.T
        v = p.to_world(pixel / [p.w, p.h])
        sx = np.clip((x - cx) / width, -1, 1)
        sy = np.clip((y - crown_y) / max(crown_y - top, fw * 0.84), -1, 1)
        z = cz + rx * 1.38 * np.sqrt(np.maximum(0.014, 1 - sx * sx - sy * sy))
        dg = p.face_depth[y, x]
        # Pull away from the brow, then let long locks descend in front of the collar.
        v[:, 2] = np.maximum(z, np.where(dg != 0, dg + 0.0026, cz + 0.009)) + 0.0025
        v[:, 2] += np.clip((y - self.jaw) / fw, 0, 1) * 0.056
        tri = (
            tri[:, ::-1]
            if np.median(
                np.cross(v[tri[:, 1]] - v[tri[:, 0]], v[tri[:, 2]] - v[tri[:, 0]])[:, 2]
            )
            < 0
            else tri
        )
        n = vertex_normals(v, tri)
        j = np.zeros((len(v), 4), "uint8")
        j[:, 0] = p.j["head"]
        wt = np.zeros(j.shape, "f")
        wt[:, 0] = 1
        sway = np.zeros_like(v)
        sway[:, 0] = np.clip((y - ey) / fw, 0, 1.5) * 0.004
        self.parts.append(
            (
                "Front hairline and locks",
                "hair",
                v,
                n,
                self.front_uv(v),
                j,
                wt,
                tri,
                {"Groom side": sway, "Groom drag": sway[:, [2, 1, 0]].copy()},
            )
        )
        style = HAIR[p.hair_cue][0]
        # Alpha-textured, physically layered MakeHuman strands finish the temple
        # and nape. Register their extent to this resident's actual crown and ears.
        part = "hair_" + style
        g, _ = source(part)
        mesh = g["meshes"][0]
        pr = mesh["primitives"][0]
        native, nn, joints, weights = p.skin_geometry(part, mesh, pr)
        xmid = (native[:, 0].min() + native[:, 0].max()) * 0.5
        world_eye = p.to_world(np.array([self.eyes[0] / p.w, self.eyes[1] / p.h]))
        desired_width = max(
            p.span * 0.77,
            (
                np.quantile(np.where(hair)[1], 0.97)
                - np.quantile(np.where(hair)[1], 0.03)
            )
            * p.metre
            * p.ratio
            / p.w,
        )
        factor = np.clip(desired_width / max(0.01, np.ptp(native[:, 0])), 0.64, 1.4)
        native[:, 0] = world_eye[0] + (native[:, 0] - xmid) * factor
        native[:, 1] += (
            p.to_world(np.array([cx / p.w, top / p.h]))[1] - native[:, 1].max()
        )
        tris = accessor(part, pr["indices"]).reshape(-1, 3)
        center = native[tris].mean(1)
        outer = np.abs(center[:, 0] - world_eye[0]) / max(0.01, desired_width * 0.5)
        tris = tris[
            (center[:, 2] < cz + rx * (0.20 + 0.52 * np.clip(outer, 0, 1)))
            | (
                (center[:, 1] > world_eye[1] + p.span * 0.48)
                & (center[:, 2] < cz + rx * 0.94)
            )
        ]
        chosen, ind = np.unique(tris, return_inverse=True)
        if len(chosen):
            native[:, 2] -= 0.003
            self.parts.append(
                (
                    "Temple and nape strands",
                    "native-hair",
                    native[chosen],
                    nn[chosen],
                    accessor(part, pr["attributes"]["TEXCOORD_0"])[chosen],
                    joints[chosen],
                    weights[chosen],
                    ind.reshape(-1, 3),
                    {},
                )
            )
        if style in ("ponytail01", "braid01", "long01", "bob01", "bob02"):
            extra = {
                "ponytail01": 0.73,
                "braid01": 1.46,
                "long01": 1.5,
                "bob01": 0.73,
                "bob02": 0.77,
            }[style]
            y = np.linspace(ey, ey + fw * extra, 25)
            t = np.linspace(0, 1, len(y))
            base = fw * (0.20 if style in ("ponytail01", "braid01") else 0.52)
            cx2 = cx + (0.09 * fw * np.sin(t * np.pi) if style == "braid01" else 0)
            r = base * (
                0.84 + 0.14 * np.cos(t * 12 * np.pi)
                if style == "braid01"
                else 1 - 0.25 * t
            )
            r *= np.clip((1 - t) * 7, 0.08, 1)
            # Rear strands/locks use material samples, never a second image of the face.
            a = len(self.parts)
            self.section(
                "Nape • " + style,
                "hair",
                y,
                cx2 - r,
                cx2 + r,
                np.full(len(y), cz - rx * 0.81),
                np.maximum(
                    0.005,
                    np.broadcast_to(r, np.shape(y)) * p.metre * p.ratio / p.w * 0.47,
                ),
                ["head"],
                [ey],
                0.0006,
            )
            label, kind, v, n, uv, j, wt, tri, m = self.parts[a]
            uv = self.rear_uv(
                "hair",
                np.clip((v[:, 0] - v[:, 0].min()) / max(0.001, np.ptp(v[:, 0])), 0, 1),
                np.clip((v[:, 1] - v[:, 1].min()) / max(0.001, np.ptp(v[:, 1])), 0, 1),
            )
            self.parts[a] = (label, kind, v, n, uv, j, wt, tri, m)

    def build(self):
        self.garments()
        self.anatomy()
        self.face()
        self.groom()
        return self.parts


@lru_cache(None)
def grid_triangles(rows, columns):
    a = np.arange((rows - 1) * columns).reshape(rows - 1, columns)[:, :-1].ravel()
    return np.concatenate(
        [
            np.column_stack((a, a + columns, a + 1)),
            np.column_stack((a + 1, a + columns, a + columns + 1)),
        ]
    )


@lru_cache(None)
def section_triangles(rows, columns):
    si = grid_triangles(rows, columns)
    si = (si // columns) * columns * 2 + si % columns
    t = np.concatenate([si, si + columns])
    # Seal both ends across the whole circumference, skipping duplicated seam vertices.
    rim = np.r_[np.arange(columns), np.arange(columns + 1, 2 * columns - 1)]
    cap = np.stack([np.full(len(rim) - 2, rim[0]), rim[1:-1], rim[2:]], 1)
    return np.concatenate([t, cap[:, ::-1], cap + (rows - 1) * 2 * columns])


def vertex_normals(v, t):
    n = np.zeros_like(v)
    face = np.cross(v[t[:, 1]] - v[t[:, 0]], v[t[:, 2]] - v[t[:, 0]])
    for i in range(3):
        np.add.at(n, t[:, i], face)
    return n / np.maximum(1e-9, np.linalg.norm(n, axis=1)[:, None])
