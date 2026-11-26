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

A neutral camera render can be compared directly with the original casting photograph. The comparison aligns the eye positions and scale and preserves each image’s lighting. The full-length photograph supplies the measured facial shape, expression and primary color. A second, higher-resolution photograph supplies fine skin detail and the exposed neck. The hair shell carries the frontal fringe mask. Separate strips form the bun, loose locks and flyaways. The jacket, jeans and shirt use individual color, roughness and normal maps. The windbreaker includes skinned welt pockets, zip tapes, teeth, snaps, eyelets and drawcords. [Aligned likeness comparison](Residents/AH-R0001/likeness-review.jpg)

| Operation on the shared Mac | Measured elapsed time |
| --- | ---: |
| Prepare five photographic fitting and texture stages from empty output folders | 4.20 s |
| Recheck the same five stages with unchanged inputs | 0.03–0.13 s |
| Build Ida from an empty resident output folder, inspect foot contact, render the sculpt, turntable and portraits, register the comparison and pack the standalone Blender scene | 79.73 s |

The clean build started with the three casting photographs, Ida’s written persona and approved art direction. It reused the installed landmark models, anatomy library, motion captures and authored garment and groom recipes. Other work was running on the Mac. Producing new photographs, designing an unfamiliar hairstyle or outfit, correcting poses, reviewing likeness, encoding full performances and verifying the live game all take additional time. The local fit cache hashes each stage’s inputs and checks that its outputs exist before skipping it.

## Package a resident for the game

Run this command from the repository root with the Blender executable on your path.

```sh
blender -b --factory-startup --python-exit-code 1 \
  -P 'Character Sources/tools/game_character.py' -- \
  AH-R0001 asphalt-heat/assets/residents/ida-mercer.glb
```

Each resident can supply a `game-actions.json` beside the Blender master. It selects clips from shared captures or that resident’s own performances. Ida’s package includes her laundry-basket lift, a conversational eyebrow raise and her corrected recovery. The exporter writes the joints, skin weights, garment materials and performances into one GLB. Running it again checks the saved file against its content hash. Add `--texture-size 512` after the output path to make a smaller copy for a character viewed at a distance.

Ida’s full-resolution game package measured 5,005,596 bytes. Packaging the fitted master and existing takes took 6.35 seconds on the shared Mac. Verifying an unchanged package took 1.37 seconds. At Ida’s size, 1,500 game packages alone would take 7.51 GB. Within the 5 GB allowance, keep the shared anatomy, photographs and individual recipes, and export full-resolution packages for the residents appearing in the current scene. Bake smaller texture variants for residents seen at a distance and budget the size of those files as well.

## Review Ida in the Wash House

Open the game with `?visit=wash-house`. Press Play with sound off. Approach Ida and press **C** to talk. If she is down, **C** offers to help her up. Her body follows the animated joints during both interactions. Measured on the exported recovery, palm clearance stayed within 2.38 mm and palm travel within 0.15 mm during the weight-bearing interval. [Recovery measurements](Residents/AH-R0001/recovery-contact.json) · [Recorded gameplay](../asphalt-heat/films/ida-at-the-wash-house.mp4)

Run `node asphalt-heat/tools/resident-test.js` to exercise the model, dialogue, collisions and recovery. To capture new footage, run the following command, then open `http://127.0.0.1:8797/index.html?agent=1&visit=wash-house` in a separate Codex in-app browser tab. Press Play and verify **Sound off**. The camera buttons save numbered frames from the active game to the selected directory.

```sh
python3 'Character Sources/tools/resident_review_server.py' \
  --frames /tmp/ida-review --port 8797
```
