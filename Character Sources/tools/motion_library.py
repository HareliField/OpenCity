"""Rebuild the actions referenced by the shared anatomical mesh."""

from pathlib import Path
import sys
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from resident_motion import ROOT, attach_library

path = ROOT / "Anatomy" / "sculpts.blend"
bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False)
bpy.context.preferences.filepaths.save_version = 0
attach_library()
bpy.ops.wm.save_as_mainfile(filepath=str(path), compress=True)
