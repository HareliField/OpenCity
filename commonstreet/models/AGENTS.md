# Game models and scenery

For new standalone scenery, follow the [model library guide](scenery/library/README.md). Before editing an existing export, locate its library record, [catalog entry](scenery/catalog.json) or corresponding loader. Read the [3D design patterns](../../docs/design-system.md#the-3d-city) and the owning [Blender](../../Blender%20Sources/AGENTS.md) or [Meshy](../../Meshy%20Sources/AGENTS.md) guide.

- Preserve the source-to-export relationship, credit, and redistribution terms. When changing an identifier, shape, pivot or dimensions, inspect the runtime placements, collision and animations that use it.
- Verify the affected model with `node tools/city-asset-test.js` from `commonstreet/`. Use the standalone preview for library models and inspect any affected in-game uses at the relevant level of detail.
