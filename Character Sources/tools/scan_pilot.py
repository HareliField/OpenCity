"""Import the Ida comparison scan, preserve rigging, attach the authored persona and render."""

import json, sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from blender_master import clear, studio

folder = ROOT / "Residents" / "AH-R0001"
clear()
bpy.ops.import_scene.gltf(filepath=str(folder / "scan-pilot.glb"))
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
person = json.loads((folder / "persona.json").read_text())
rig.name = person["name"]
for k in ("name", "personId", "residentId", "agenda", "voice", "occupation", "age"):
    rig[k] = person[k]
text = bpy.data.texts.new("Persona.json")
text.write(json.dumps(person, ensure_ascii=False, indent=2))
text.use_fake_user = True
rig["personaText"] = text.name
bpy.context.scene.frame_set(1)
for o in bpy.context.scene.objects:
    if o.animation_data:
        o.animation_data.action = None
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
bpy.context.view_layer.update()
studio(rig, folder, "scan-review.jpg")
bpy.ops.wm.save_as_mainfile(filepath=str(folder / "scan-pilot.blend"), compress=True)
