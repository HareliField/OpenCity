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
