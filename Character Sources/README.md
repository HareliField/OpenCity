# Commonstreet character sources

[One-resident factory and Ida’s movement study](Factory.md)

All 1,500 residents have an individual casting photograph, story, fitted game character and editable headless Blender master. Open the directory to find a person, then open their native scene beside the game assets. Use **Residents** in the game to compare the photograph with the actual standing mesh, meet the character, or preview a motion. [Character directory](Directory.md) · [City stories](../commonstreet/stories/residents/directory.md) · [Lev at the port](../commonstreet/films/lev-bellamy-at-the-port.mp4)

The 1,499 manufactured residents share 53-joint anatomical topology, including three joints per digit. Each person's fitted skeleton, face, scalp, clothing sections, surfaces and performance are stored individually. The native **Persona** text contains their family, relationships, voice, work, agenda and three reactions. The **Walk** and **Speak** actions are editable in Blender. The event tool fits additional capture takes to the same person. [Event playback and capture sources](Motion/README.md)

## Photography and sculpting

There are 143 independently generated studio references. The other 1,357 are individually composed photographic portraits. Their casting receipts identify the source wardrobe, hair, face and feature references. The factory registers the complete standing silhouette, 468 facial landmarks and visible hand landmarks. Front garments use the photographed folds and closures. The factory reconstructs garment depth, concealed layers and the rear groom. [Lev’s photo and two sculpt views](Reviews/lev-bellamy.jpg)

The editable meshes and skin weights live in each native master. Its textures and the individual source glTF resolve to the same files that ship under `commonstreet/assets/residents`. Keep the repository directory layout when moving a master. Each manufactured resident's `manufacture.json` identifies the reference photograph, geometry and Blender scene by checksum.

Ida’s folder contains two independent reconstructions. `character.blend` is the open-source sculpt. `scan-pilot.blend` contains the rigged Meshy comparison model generated from the same photograph. `scan-receipt.json` records the 35-credit scan and 5-credit rig. The other residents use the open-source workflow.

## Character build test

The [Character Build Test](Character%20Build%20Test/README.md) contains the original Meshy character, both optimized versions, and six fitted garment GLBs from the cloth preview.

## Rebuild from source

From the repository root, use a Python environment with NumPy, SciPy, Pillow, OpenCV and MediaPipe, a Blender command-line executable, and libzstd. The MediaPipe model directory contains `face_landmarker.task`, `pose_landmarker.task`, `hair.tflite` and `hand_landmarker.task`. [Face](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) · [Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) · [Multiclass selfie segmentation](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter) · [Hands](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)

```sh
python 'Character Sources/tools/population_photos.py' "$CAST_MODEL_DIR"
python 'Character Sources/tools/manufacture_residents.py' commonstreet/assets/residents "$BLENDER" --hand-model "$CAST_MODEL_DIR/hand_landmarker.task"
python 'Character Sources/tools/cast_motions.py' commonstreet/assets/residents
"$BLENDER" -b --threads 3 --python-exit-code 1 --python 'Character Sources/tools/cast_previews.py' -- commonstreet/assets/residents/standing
python 'Character Sources/tools/check_population.py'
```

The manufacturer checkpoints each native model and game package. Starting it again processes outstanding residents. Blender opens each completed master to verify the rig, textures and persona and render its standing portrait. The validation tool checks the complete roster, skin weights, file references, checksums, family links and the five-billion-byte budget.

## Ida’s sculpt and source provenance

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
