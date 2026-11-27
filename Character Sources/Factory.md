# One resident at a time

Ida Mercer is the first performance study. She operates the Wash House and lends Rafael her bank-meeting jacket. When he asks people to stop fussing over the suit, she lets go and gives him room. That decision determines the movement in the review clip. The other residents’ draft scenes retain their own biographies and gestures.

## Build the character before commissioning the next portrait

1. **Cast from the biography.** Choose the age, recognizable features, garment cut, posture and one reaction worth seeing. Ida raises one eyebrow before agreeing. Her red windbreaker has a loop of thread through its lowest buttonhole.
2. **Fit one body.** Use a front studio photograph for proportions. Add a profile and rear view for the hair mass, neckline, hood and hem. A close-up with the fringe pinned back keeps eyebrow and forehead skin available beneath the groom. Generated side and rear views are design references whose details require comparison with the original photograph.
3. **Build the editable parts.** Fit the anatomical body and joint centers first. Reconstruct the facial surface from 468 landmarks and register its color from the close-up. Keep the eyes, lashes, mouth interior, teeth and tongue in the source. The neutral facial surface supplies the photographed eyes in the pilot render. Groom the scalp, coil the bun and shape the fringe. Sculpt the windbreaker cuffs and hem over the dress form, then add the folded hood, thread and earrings.
4. **Act the scene.** Retarget recorded body motion to the resident’s fitted joints. Ida crosses the shop at an easy pace, acknowledges Rafael with a raised brow and open hands, then backs off. Per-frame contact correction keeps the supporting sole on the floor through clip transitions. Her loose hair and jacket settle with delayed motion.
5. **Review the saved performance.** Watch the full-body film at its recorded cadence. Inspect the wrist range, the clearance of each swinging shoe and the height variation of the supporting sole. The work take adds an actual laundry basket fitted to her hands. The injury take shows her duck, flinch, favor a leg, fall and rise. Compare the front, rear and detail views with her casting photographs.
6. **Record the feedback on this resident.** The `art-direction.json` beside the model carries the garment cut, groom, visual details and performance notes. Refine the resident before carrying a technique into another character. Each new performance needs a circumstance from that character’s story.

## Run a single build

Use Python with MediaPipe, NumPy, Pillow and OpenCV. Movie encoding also uses imageio-ffmpeg. The model filenames and their download links are in the character-source guide. The script invokes Blender in background mode and takes one resident ID per invocation.

```sh
python 'Character Sources/tools/factory.py' AH-R0001 \
  --models /path/to/mediapipe-models \
  --blender /path/to/blender --render-motion
```

The editable master is `character.blend`. The fitted face, skinned body and clothing, armature action, pose controls and authored persona can be inspected separately. `movement.mp4` is the performance review. `movement-check.json` reports foot clearance, travel and hand movement measured after reopening the scene. The expanded sculpt-master.blend packs the editable copy for use on another machine. `turntable.jpg` is the shape review. [Ida’s sources](Residents/AH-R0001) · [Cast directory](Directory.md)

[Shared actions and event playback](Motion/README.md) · [Wash House work take](Residents/AH-R0001/laundry-shift.mp4) · [Injury and recovery take](Residents/AH-R0001/injury-recovery.mp4)

## Ida’s source build

Ida’s original full-length casting photograph supplies the facial proportions, fringe, hairline, garment colours and standing landmarks. The approved 4K capture supplies the actual open windbreaker, hood, shirt, denim folds and worn trainers. A 4K colour atlas transfers the original photographed clothing detail onto the visible fitted garment triangles. Only the shaded colour difference in the registered standing view is baked. Unseen areas retain their scanned albedo, and the original normal and roughness maps continue to describe the fabric. Each garment is fitted in her standing pose, then transformed back into skeleton rest space so it drapes around the moving body. The capture supplies one continuous head and throat beneath the frontal facial detail. Her fitted head, earrings, hair, eyelids and rotation pivot share the same full-length registration. [Full-length comparison](Residents/AH-R0001/standing-comparison.jpg) · [Clothing and hair detail](Residents/AH-R0001/clothing-and-hair.jpg)

The side locks follow curved paths around her temples. The fitted surface preserves the depth of the scanned ears and hair roots. The scalp underneath follows the head when Ida bows or pushes up from the floor. The game renders the rear crown with a depth-writing cutout and keeps the soft photographed fringe over it. The face has an animated listening brow, and its skin writes depth so the near cheek and nose occlude the far side. Each short nail follows its own distal finger joint. The Wash House lights her with ceiling strips, window fill and reflected light beneath her jaw. [Game frame beside the casting photograph](Residents/AH-R0001/wash-house-comparison.jpg)

The production runner hashes the photographs, capture, anatomy, motion inputs and build tools. A new resident requires their own visual inputs and garment fitting. A receipt can reproduce an existing look or skip an unchanged package. Artist time spent fitting and reviewing a new look is additional.

### Transfer the photographed fabric

In a private working copy, build the fitted standing character with `wardrobeScan` set and `workwearAlbedo` omitted from the art direction. Export its game package and register the standing landmarks to the original photograph. The transfer tool poses that package in Idle, renders it at the registered camera, and projects the visible fabric differences back onto the scan's UV map. It needs a C++17 compiler and the same Python environment as the factory.

```sh
resident='Character Sources/Residents/AH-R0001'
python 'Character Sources/tools/bake_workwear.py' /path/to/uncorrected-ida.glb \
  "$resident/scan-pilot.glb" "$resident/reference.jpg" "$resident/standing-fit.json" \
  "$resident/captured-workwear.png" --segmenter /path/to/hair.tflite \
  --report "$resident/workwear-lineage.json"
```

Set `workwearAlbedo` to `captured-workwear.png` for the final build. For a different outfit, supply a photo-size single-channel `--garment-mask` in place of the example segmenter. Its pixel labels are 0 for background and skin, 1 for the jacket, 2 for the shirt, 3 for the jeans and 4 for the shoes. Verify new silhouettes and occlusion against the resident’s standing photograph.

## Package a resident for the game

Run this command from the repository root with the Blender executable on your path.

```sh
blender -b --factory-startup --python-exit-code 1 \
  -P 'Character Sources/tools/game_character.py' -- \
  AH-R0001 commonstreet/assets/residents/ida-mercer.glb
```

Each resident can supply a `game-actions.json` beside the Blender master. It selects clips from shared captures or that resident’s own performances. Ida’s package includes her laundry-basket lift, a conversational eyebrow raise and her corrected recovery. The exporter writes the joints, skin weights, garment materials and performances into one GLB. Running it again checks the saved file against its content hash. Add `--texture-size 512` after the output path to make a smaller copy for a character viewed at a distance.

Ida has 53 deforming joints and nine exported actions. The pickup, carry and set-down clips fit her arms and curled fingers to the basket handles. Her standing wrists, elbows, fingers and ankles are checked against the original full-length photograph, and her shoes are tested through the planted phase of each stride. [Standing measurements](Residents/AH-R0001/standing-fit.json)

A full-resolution resident with a dedicated scan uses considerably more than the 3.33 MB per resident available if the entire 5 GB allowance were split evenly across 1,500 people. The allowance also covers source scenes and casting images. Reuse shared rest geometry, UVs and motion, and measure the resident-specific geometry and textures before committing a production batch.

## Build an approved cast

For a sequential production run, put one approved resident ID per line in a text file. Start with `AH-R0001` to reproduce Ida. The runner reads each person’s own photographs, art direction and motion takes. It verifies the input files, builds in private scratch space and publishes one `<resident ID>.glb` per person. Unchanged packages resume from verified receipts. The optional budget counts the decimal megabytes occupied by GLBs in the output directory. Allow additional space for your source, scratch files and reviews.

```sh
python 'Character Sources/tools/approved_cast.py' /path/to/approved.txt \
  --models /path/to/mediapipe-models --output /path/to/game-packages \
  --texture-size 512 --gzip --max-package-mb 3900
```

Omit `--texture-size` and `--gzip` for the full-resolution GLB used in the Wash House. With `--gzip`, the runner stores a `.glb.gz`. The local game server serves its decoded bytes at the ordinary `.glb` URL. Use `--dry-run` to see which packages would rebuild. One shared skeleton and motion library serve the cast. Each dossier supplies its own appearance and performance. The Wash House outfit and groom can also be selected independently using the `wardrobeRecipe` and `groomRecipe` fields. [Appearance recipes](tools/appearance_recipes.py)

The production command builds one resident at a time in private scratch space. It skips studio review images and movie encoding. An unchanged package is reused only after its complete output hash and all input hashes match the stored receipt. On the shared Mac, rebuilding Ida’s full-resolution package from her fitted sources took 55.74 seconds and reproduced all 19,300,852 bytes filmed in the game. Verifying the unchanged build took 0.76 seconds. Both timings exclude art direction, original capture and the one-time fabric transfer.

## Review Ida in the Wash House

Open the game with `?visit=wash-house`. Press Play with sound off. Approach Ida and press **C** to talk. If she is down, **C** offers to help her up. Her contact volumes follow the moving joints, including the head, feet and fingers. The standing probe checks 56 rays through visible body parts and the swept player capsule at sprint speed from all four directions. The recovery measurement follows the actual palm, knee, shoe and cloth surfaces. [Recovery measurements](Residents/AH-R0001/recovery-contact.json) · [Recorded gameplay](../commonstreet/films/ida-at-the-wash-house.mp4)

Run `node commonstreet/tools/resident-test.js` to exercise gait, grip, dialogue, collisions and recovery. Run `node commonstreet/tools/resident-secondary-test.js` to check garment settling and elbow folds. To capture new footage, run the following command, then open `http://127.0.0.1:8797/index.html?agent=1&visit=wash-house` in a separate Codex in-app browser tab. Press Play and verify **Sound off**. The camera buttons save numbered frames from the active game to the selected directory.

```sh
python3 'Character Sources/tools/resident_review_server.py' \
  --frames /tmp/ida-review --port 8797
```
