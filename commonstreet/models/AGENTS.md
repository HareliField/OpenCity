# Game models and scenery

Before editing an export, locate its entry in the [scenery catalog](scenery/catalog.json) or corresponding loader. Read the [3D design patterns](../../docs/design-system.md#the-3d-city) and the owning [Blender](../../Blender%20Sources/AGENTS.md) or [Meshy](../../Meshy%20Sources/AGENTS.md) guide.

- Preserve the source-to-export relationship, credit, and redistribution terms. When changing an identifier, shape, pivot or dimensions, inspect the runtime placements, collision and animations that use it.
- Verify the affected model with `node tools/city-asset-test.js` from `commonstreet/` where the catalog is covered. Inspect it in its ordinary game placement and at the level of detail the change affects.
