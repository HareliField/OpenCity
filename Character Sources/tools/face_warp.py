"""Smooth registration of neutral facial coordinates to casting-photo landmarks."""

import numpy as np

# Outer boundary of the 468-point MediaPipe face mesh in contour order.
FACE_OVAL = [
    10,
    338,
    297,
    332,
    284,
    251,
    389,
    356,
    454,
    323,
    361,
    288,
    397,
    365,
    379,
    378,
    400,
    377,
    152,
    148,
    176,
    149,
    150,
    136,
    172,
    58,
    132,
    93,
    234,
    127,
    162,
    21,
    54,
    103,
    67,
    109,
]


def warp(anchors, target, xy):
    # Thin-plate spline from neutral anatomical points to the landmarked casting photo.
    def kernel(a, b):
        r2 = ((a[:, None] - b[None, :]) ** 2).sum(axis=2)
        return r2 * np.log(np.maximum(r2, 1e-12))

    n = len(anchors)
    p = np.column_stack((np.ones(n), anchors))
    system = np.block(
        [[kernel(anchors, anchors) + np.eye(n) * 0.0002, p], [p.T, np.zeros((3, 3))]]
    )
    coeff = np.linalg.solve(system, np.vstack((target, np.zeros((3, 2)))))
    return (
        kernel(xy, anchors) @ coeff[:n]
        + np.column_stack((np.ones(len(xy)), xy)) @ coeff[n:]
    )
