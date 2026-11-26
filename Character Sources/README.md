# Asphalt Heat character sources

[One-resident factory and Ida’s movement study](Factory.md)

Each resident has an individual native Blender scene under `Residents/AH-R####/character.blend`. Open it alongside the `Anatomy` folder. The body, hands, eyes, lashes, teeth, tongue, clothes and hair are separate parts. Each rig has 53 joints and its own listening gesture. The scene stores the resident’s sculpt controls, proportions, face, wardrobe palette and strand groom. Shared topology and textures keep the cast small enough to edit locally.

The armature carries the stable resident and police identifiers. The **Persona.json** text in the scene contains the resident’s biography, voice, agenda, family, social relationships and three authored reactions. The same data is available as plain JSON beside the scene. The native scenes link to 24 shared full-body actions. Ida’s fitted scene adds her timed response to Rafael. [Motion library and event playback](Motion/README.md) The three written reactions are available to a game system as data.

[Find a character by name](Directory.md) · [Browse the written cast](../asphalt-heat/stories/residents/directory.md) · [Open Ida’s character folder](Residents/AH-R0001) · [Open the first 150 biographies](../asphalt-heat/stories/residents/01)

## Photography and sculpting

A resident with a `reference.jpg` has a full-length casting photograph. `photo-fit.json` records the reference checksum, measured facial proportions, body landmarks and sampled colors. Face and garment maps register visible detail to the neutral 3D surface. Sides, backs, mouth interiors and hidden clothing folds come from the anatomy and wardrobe library. A resident without photographic measurements has a story-based casting sculpt.

The native scene supports posing and adjustment of the sculpt controls. To edit vertices directly, materialize a full local mesh with the command below. The individual glTF stores skinning, identity morphs, materials and persona data. It points to the buffer library under `Anatomy`. The Blender scene also includes the fitted photographic materials and groom when available.

Ida’s folder contains two independent reconstructions. `character.blend` is the open-source sculpt. `scan-pilot.blend` contains the rigged Meshy comparison model generated from the same photograph. `scan-receipt.json` records the 35-credit scan and 5-credit rig. The other residents use the open-source workflow.

## Rebuild from source

Run from the repository root. All Blender commands below use background mode. Building an expanded sculpt creates a larger per-resident file.

```sh
python3 'Character Sources/tools/compile_personas.py'
python3 'Character Sources/tools/build_cast.py' AH-R0001
blender -b --factory-startup --python-exit-code 1 -P 'Character Sources/tools/linked_masters.py' -- --library
blender -b --factory-startup --python-exit-code 1 -P 'Character Sources/tools/linked_masters.py' -- --review AH-R0001
blender -b --factory-startup --python-exit-code 1 -P 'Character Sources/tools/blender_master.py' -- AH-R0001
```

Photographic fitting requires Python with MediaPipe, Pillow, NumPy and OpenCV. Place the models below in one directory with the indicated filenames. Pass that directory and resident IDs to `tools/fit_photo.py`, then rebuild the native scenes. The studio references use individual ImageGen photographs and locally synthesized photographs from Realistic Vision. A matching `casting.json` records a local photograph’s seed, conditioning source and checksum. The local workflow uses stable-diffusion.cpp on loopback and a photographic pose reference. [Realistic Vision](https://huggingface.co/SG161222/Realistic_Vision_V6.0_B1_noVAE) · [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp)

- `face_landmarker.task` uses the [MediaPipe face landmark model](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task).
- `pose_landmarker.task` uses the [MediaPipe lightweight body model](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task).
- `hair.tflite` uses the [MediaPipe multiclass portrait segmenter](https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite).

The anatomical meshes, joint targets, basic hairstyles and garment topology derive from MakeHuman and the CC0 CharacterCreator exports at revision `852e48f316b90a0937234886630e4fb4cdfd1f78`. The local tools add city-specific identity, fitting, texturing, hair strands, rig adjustments and gestures. [Upstream asset provenance](Anatomy/LICENSE-NOTES.md) · [Pinned source](https://github.com/kblood/CharacterCreator/tree/852e48f316b90a0937234886630e4fb4cdfd1f78)

The facial topology follows the MediaPipe canonical face. The fitted vertex positions come from each resident’s own reference. [MediaPipe license](Anatomy/MediaPipe-LICENSE) · [Canonical face mesh](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj)
