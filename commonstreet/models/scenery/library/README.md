# Commonstreet model library

Add a model here and another contributor can place it later. The preview works as soon as the two files are present.

1. Pick a unique lowercase ID with hyphens, such as `painted-window-box`. Check the filenames here and the IDs in the [existing catalog](../catalog.json).
2. Export a static, self-contained glTF 2.0 binary in metres and put it at `commonstreet/models/scenery/<id>.glb`. Use embedded textures and buffers and export without a separate decoder. Keep the editable source or a reference to it. See the [3D design patterns](../../../../docs/design-system.md#the-3d-city) for scale, materials, and detail.
3. Add `<id>.json` in this directory with a `title`, `source`, `credit`, and `redistribution`. Give the source location and the terms that allow the project to share the work. Use the [shop register](shop-register.json) as a file layout example and supply the terms for your own art.
4. From the repository root run `node commonstreet/tools/city-asset-test.js`, then start [the local server](../../../../docs/development.md#start-a-local-preview). Open [Model preview](http://127.0.0.1:8765/model-preview.html), enter the ID, and check the dimensions, materials, and shape from multiple angles. Share the ID and a preview image with the PR.

The loader puts the bottom of the model at y = 0 and centres it on x and z. Optional `yaw` rotates the export around y in radians before measuring it. Optional `anchor` offsets the centred model in fractions of its width and depth. Correct the source export for new assets when practical. `heightScale` is an optional positive vertical correction for exports that need it.

The record describes appearance and provenance. See [decorative placements](../../../world/decorations/README.md) to use the same model in one or more locations. Doors, vehicles, and other interactive objects use their respective systems for motion, collision, and use.
