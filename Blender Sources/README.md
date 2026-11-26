# Asphalt Heat object library

The Blender file contains individually named, editable collections and a display scene that instances them. All dimensions are in metres. The source photographs are numbered in the companion JSON. A pump's internal dimensions were inferred from the installed piping. The gallery preview in the game uses the same exports as normal play.

Run these commands from the repository root with a Python environment containing Blender’s `bpy` module, NumPy and Pillow. Both scripts work headlessly.

```sh
python -B asphalt-heat/tools/city-finishes.py
python -B asphalt-heat/tools/blender-city-assets.py
```

The first script extracts material surfaces and store prints from the supplied photographs. The second assembles metric parts, bakes short-range contact shading, packs source textures into the Blender file and exports GLBs to the game's scenery directory. Fixed components share a mesh per asset. Washers, refrigerator panels, fans, couplings and barber poles retain separate origins for movement.
