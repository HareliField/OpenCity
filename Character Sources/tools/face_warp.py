"""Smooth registration of neutral facial coordinates to casting-photo landmarks."""

import numpy as np


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
