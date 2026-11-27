# Editable Blender libraries

Read the [Blender source guide](README.md) for the specific collection, its companion JSON, and its generator. Use the [3D design patterns](../docs/design-system.md#the-3d-city) for scale, materials, and browser review.

- Keep source geometry editable and dimensions in metres. Preserve named collection entries and moving parts, including the pivots the game expects.
- Generate the affected exports from their source. Check matching catalog and runtime placement or collision changes. Review which Blender files, JSON references and exports changed before committing.
- Record reference sources and credit. Coordinate with anyone already editing the same binary library.
