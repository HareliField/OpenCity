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

The source build starts with three casting photographs, Ida’s persona and approved art direction. It reuses the installed landmark models, anatomy library, motion captures and garment and groom recipes. Creating a new look, fitting an unfamiliar garment, directing new performances and reviewing them in the city take additional artist time. The source build stores editable geometry, and the factory hashes each photographic stage’s inputs for reuse during revisions.

## Package a resident for the game

Run this command from the repository root with the Blender executable on your path.

```sh
blender -b --factory-startup --python-exit-code 1 \
  -P 'Character Sources/tools/game_character.py' -- \
  AH-R0001 asphalt-heat/assets/residents/ida-mercer.glb
```

Each resident can supply a `game-actions.json` beside the Blender master. It selects clips from shared captures or that resident’s own performances. Ida’s package includes her laundry-basket lift, a conversational eyebrow raise and her corrected recovery. The exporter writes the joints, skin weights, garment materials and performances into one GLB. Running it again checks the saved file against its content hash. Add `--texture-size 512` after the output path to make a smaller copy for a character viewed at a distance.

The final playable model is 6,721,596 bytes and contains nine clips. The pickup, carry and set-down actions fit the individual arms and curled fingers to handles 620 mm apart. The game blends per-foot planting with a complete walking stride to turn the body around a washer. Loose hair, the windbreaker hood and the hem follow the moving joints with damped motion. Each sleeve folds according to its elbow angle.

| Texture size | Raw GLB | Lossless gzip storage | 1,500 at the compressed size |
| --- | ---: | ---: | ---: |
| Full resolution | 6.72 MB | 4.70 MB | 7.05 GB |
| Maximum dimension 512 pixels | 4.56 MB | 2.54 MB | 3.81 GB |
| Maximum dimension 256 pixels | 4.16 MB | 2.14 MB | 3.21 GB |

The last column extrapolates from Ida and covers game packages only. Keep full resolution for close interactions and smaller copies for background residents. Reserve space for casting photographs, editable sources, temporary build files and review media within the overall 5 GB allowance.

## Build an approved cast

For a sequential production run, put one approved resident ID per line in a text file. Start with `AH-R0001` to reproduce Ida. The runner reads each person’s own photographs, art direction and motion takes. It verifies the input files, builds in private scratch space and publishes one `<resident ID>.glb` per person. Unchanged packages resume from verified receipts. The optional budget counts the decimal megabytes occupied by GLBs in the output directory. Allow additional space for your source, scratch files and reviews.

```sh
python 'Character Sources/tools/approved_cast.py' /path/to/approved.txt \
  --models /path/to/mediapipe-models --output /path/to/game-packages \
  --texture-size 512 --gzip --max-package-mb 3900
```

Omit `--texture-size` and `--gzip` for the full-resolution GLB used in the Wash House. With `--gzip`, the runner stores a `.glb.gz`. The local game server serves its decoded bytes at the ordinary `.glb` URL. Use `--dry-run` to see which packages would rebuild. One shared skeleton and motion library serve the cast. Each dossier supplies its own appearance and performance. The Wash House outfit and groom can also be selected independently using the `wardrobeRecipe` and `groomRecipe` fields. [Appearance recipes](tools/appearance_recipes.py)

The manufacturing run uses the approved photographs, art direction and authored takes, builds the fitted model in private scratch, then exports directly. On the shared Mac, a clean full-resolution run took 13.31 seconds. Its GLB was byte-for-byte identical to the one filmed in the game. Checking the input receipt and the complete output hash took 0.38 seconds on a repeat run. The earlier route through the studio portrait, turntable, review and packed-master stages took 67.63 seconds with other renders running. Use the full studio build when revising a look or producing an editable master.

## Review Ida in the Wash House

Open the game with `?visit=wash-house`. Press Play with sound off. Approach Ida and press **C** to talk. If she is down, **C** offers to help her up. Her body follows the animated joints during both interactions. Measured on the exported recovery, palm clearance stayed within 2.38 mm and palm travel within 0.12 mm during the weight-bearing interval. The nearest knee was within 0.99 mm during that plant. The largest remaining floor intersection in the exported shoe or denim was 1.13 mm. [Recovery measurements](Residents/AH-R0001/recovery-contact.json) · [Recorded gameplay](../asphalt-heat/films/ida-at-the-wash-house.mp4)

Run `node asphalt-heat/tools/resident-test.js` to exercise gait, grip, dialogue, collisions and recovery. Run `node asphalt-heat/tools/resident-secondary-test.js` to check garment settling and elbow folds. To capture new footage, run the following command, then open `http://127.0.0.1:8797/index.html?agent=1&visit=wash-house` in a separate Codex in-app browser tab. Press Play and verify **Sound off**. The camera buttons save numbered frames from the active game to the selected directory.

```sh
python3 'Character Sources/tools/resident_review_server.py' \
  --frames /tmp/ida-review --port 8797
```
