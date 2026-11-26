"""Fit the volume of the groom to the casting photograph, in units of outer-eye span."""

import numpy as np


def profile(guide):
    mask = guide["mask"].astype(bool)
    origin = guide["eyes"]
    span = float(guide["span"])
    height = (origin[1] - np.arange(mask.shape[0])) / span
    left, right, valid = [], [], []
    # The fringe separates into two thin locks below the eye line. Those strands
    # belong on cards. Treating them as the width of a solid ring folds the mesh
    # across the mouth when one side of the row contains no hair.
    for row, line in enumerate(mask):
        hits = np.flatnonzero(line)
        if height[row] < 0.12 or len(hits) < 5:
            continue
        a, b = np.quantile(hits, [0.025, 0.975])
        left.append((a - origin[0]) / span)
        right.append((b - origin[0]) / span)
        valid.append(row)
    rows = np.asarray(valid)
    kernel = np.hanning(19)
    kernel /= kernel.sum()

    def smooth(v):
        return np.convolve(np.pad(v, (9, 9), mode="edge"), kernel, mode="valid")[::-1]

    left = smooth(left)
    right = smooth(right)
    return (
        np.r_[-0.94, -0.48, -0.15, height[rows][::-1]],
        np.r_[-0.72, -0.87, -0.99, left],
        np.r_[0.72, 0.87, 0.99, right],
    )


def shell(angle, t, span, outline):
    cos = np.cos(angle)
    sin = np.sin(angle)
    z, left, right = outline
    crown = z[-1] + 0.018
    horizon = 1.69 + 0.44 * (1 - cos) * 0.5 - 0.04 * np.abs(sin) ** 4
    theta = t * horizon
    dz = (crown + 0.075) * np.cos(theta) - 0.075
    a = np.interp(dz, z, left)
    b = np.interp(dz, z, right)
    # The side meridians follow each measured silhouette independently. The
    # anterior half sweeps continuously across the brow and into the temples.
    middle = (a + b) * 0.5
    radius = np.maximum(0.002, (b - a) * 0.5)
    pole = np.sqrt(np.clip((crown - dz) / 0.025, 0, 1))
    x = span * (middle + sin * radius * pole)
    y = -0.043 - span * (1.14 + 0.16 * np.maximum(0, cos)) * cos * np.sin(theta)
    return x, y, span * dz
