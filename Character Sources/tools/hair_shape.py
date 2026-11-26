"""Scalp radial profile in units of eye span. Longitude zero faces the camera."""

import numpy as np


def shell(angle, t, span):
    horizon = (
        1.56 + 0.65 * (1 - np.cos(angle)) * 0.5 - 0.17 * np.abs(np.sin(angle)) ** 6
    )
    theta = t * horizon
    radius = 1 + 0.024 * np.cos(2 * angle + 0.7) * np.sin(theta) ** 2
    x = span * 1.01 * radius * np.sin(angle) * np.sin(theta)
    y = -0.057 - span * (1.21 + 0.43 * np.maximum(0, np.cos(angle))) * radius * np.cos(
        angle
    ) * np.sin(theta)
    dz = span * (1.43 * np.cos(theta) - 0.055)
    return x, y, dz
