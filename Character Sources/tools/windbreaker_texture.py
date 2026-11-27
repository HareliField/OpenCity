"""Project the photographed shell onto the recut pattern, including the closed pocket panels."""

import bpy
import numpy as np


def pixels(path):
    image = bpy.data.images.load(str(path), check_existing=True)
    width, height = image.size
    data = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(data)
    return data.reshape(height, width, 4)


def project(jacket, folder, prefix):
    mesh = jacket.data
    mesh.calc_loop_triangles()
    intrinsic = mesh.uv_layers["UVMap"]
    front = mesh.uv_layers["Front garment"]
    painted = pixels(folder / (prefix + "-albedo.jpg"))
    h, w = painted.shape[:2]
    colour = pixels(folder / (prefix + "-photo.png"))
    size = np.array([w - 1, h - 1])
    photo_size = np.array([colour.shape[1] - 1, colour.shape[0] - 1])
    uv = np.array([l.uv[:] for l in intrinsic.data]) * size
    frontal = np.array([l.uv[:] for l in front.data]) * photo_size
    coverage = np.array(
        [item.color[0] for item in mesh.color_attributes["Front garment coverage"].data]
    )
    base = painted.copy()
    for tri in mesh.loop_triangles:
        loops = np.array(tri.loops)
        tex = uv[loops]
        delta = np.array([tex[1] - tex[0], tex[2] - tex[0]]).T
        if abs(np.linalg.det(delta)) < 0.02:
            continue
        x0, y0 = np.maximum(0, np.floor(tex.min(0) - 1).astype(int))
        x1, y1 = np.minimum([w, h], np.ceil(tex.max(0) + 2).astype(int))
        yy, xx = np.mgrid[y0:y1, x0:x1]
        weights = (
            np.stack([xx - tex[0, 0], yy - tex[0, 1]], axis=-1) @ np.linalg.inv(delta).T
        )
        u, v = weights[:, :, 0], weights[:, :, 1]
        weights = np.dstack((1 - u - v, u, v))
        mask = np.all(weights > -0.015, axis=2)
        if not np.any(mask):
            continue
        y, x = yy[mask], xx[mask]
        blend = weights[mask]
        src = np.clip(blend @ frontal[loops], 0, photo_size)
        xi, yi = src.astype(int).T
        xf, yf = (src - np.floor(src)).T
        xe, ye = np.minimum(xi + 1, photo_size[0]), np.minimum(yi + 1, photo_size[1])
        shade = (colour[yi, xi] * (1 - xf)[:, None] + colour[yi, xe] * xf[:, None]) * (
            1 - yf
        )[:, None]
        shade += (
            colour[ye, xi] * (1 - xf)[:, None] + colour[ye, xe] * xf[:, None]
        ) * yf[:, None]
        a = np.clip(blend @ coverage[list(tri.vertices)], 0, 1) * shade[:, 3]
        painted[y, x, :3] = (
            base[y, x, :3] + (shade[:, :3] - base[y, x, :3]) * a[:, None]
        )
    result = bpy.data.images.new("Fitted " + prefix, width=w, height=h, alpha=False)
    result.pixels.foreach_set(np.ascontiguousarray(painted, dtype="f").ravel())
    result.filepath_raw = str(folder / (prefix + "-fitted.jpg"))
    result.file_format = "JPEG"
    result.save()
    return result
