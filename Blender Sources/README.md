# Asphalt Heat object library

The Blender file contains individually named, editable collections and a display scene that instances them. All dimensions are in metres. The source photographs are numbered in the companion JSON. A pump's internal dimensions were inferred from the installed piping. The gallery preview in the game uses the same exports as normal play.

Run these commands from the repository root with a Python environment containing Blender’s `bpy` module, NumPy and Pillow. The scripts work headlessly.

```sh
python -B asphalt-heat/tools/city-finishes.py
python -B asphalt-heat/tools/district-finishes.py
python -B asphalt-heat/tools/blender-city-assets.py
python -B asphalt-heat/tools/blender-district-fittings.py
python -B asphalt-heat/tools/blender-lighthouse.py
python -B asphalt-heat/tools/coastal-sky.py
```

The finish scripts extract material surfaces and store prints from the supplied photographs. The Blender scripts assemble metric parts, bake short-range contact shading, pack source textures into the Blender files and export GLBs to the game's scenery directory. Fixed components share a mesh per asset. Washers, refrigerator panels, fans, couplings and barber poles retain separate origins for movement.

**Lighthouse Cove** includes the keeper’s house, four turns of stair treads, iron gallery, lens and revolving optic. Its companion layout gives the game the collision coordinates from the same construction. **District fittings** includes the Harbor Supply truck, roof plant, industrial stock, salon furniture and fitted clothing. Car and truck wheel prototypes rotate around X in game coordinates.
