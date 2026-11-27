# Decorative placements

Choose an existing site file and add a record. For a new site, add one lowercase hyphenated file and list its ID in [index.json](index.json). The [Tideline Market](tideline-market.json) places the shop-register asset twice on its existing counters.

| Field | Meaning |
| --- | --- |
| `id` | Stable lowercase ID, unique within this site file. |
| `model` | ID from the [model library](../../models/scenery/library/README.md) or [scenery catalog](../../models/scenery/catalog.json). |
| `position` | World `[x, y, z]` in metres. +x is east, +z is south, and y is up. Place the base at the height of the supporting surface. |
| `size` | Local width, height, and depth in metres. Match the preview proportions unless the object needs an adjustment. |
| `yaw` | Optional heading around y, in radians. Defaults to zero. |

Run `node commonstreet/tools/city-asset-test.js` from the repository root. Preview the place in the game, walk the adjacent route, and check the surface under the object. Step closer from outside the stream range and check the final model. For the pantry counter, use `{"op":"jump","x":342.8,"y":0.17,"z":362.6,"yaw":3.141592653589793}` in [agent mode](../../README.md#agent-controller).

Use this path for objects that can safely be visual only, such as a register on a counter that already has collision. For a chair, bollard, sign over a walkway, or any other object a person or vehicle can hit or rely on, use the appropriate [world system](../../../docs/architecture.md#system-ownership).
