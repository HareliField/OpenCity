# Resident movement library

The shared anatomical mesh refers to 24 playable Blender actions. Twenty-two use human motion capture from the Carnegie Mellon University Graphics Lab. Two are authored game gestures, an empty-handed swing and a flinch. The 53-joint rig also allows independent poses, including finger articulation. The capture files describe body movement. Ida’s finger release, brow, loose strands and jacket response are authored for her scene.

The CMU collection was supported by NSF grant 0196217. The factory uses the MotionBuilder BVH conversion by Bruce Hahne. The catalog identifies the original trial, SHA-256, conversion URL, duration and sampling rate of every measured motion. [CMU Graphics Lab motion capture database](https://mocap.cs.cmu.edu/) · [Capture catalog](catalog.json)

Ida’s game walk uses frames 32 through 63 of CMU slow-walk trial 37_01. The compact capture stores the original trial identifier, pinned conversion URL, SHA-256 and sampling rate with its joint measurements. [Game stride capture](slow_stride.npz)

The factory samples at 24 fps, removes the calibration pose, aligns the capture axes and retargets rotations to the resident’s joint centers. A shared action is available in Blender’s Action Editor. The event tool retargets directly to the selected resident’s proportions and bakes overlapping clips into an editable action. Grounded takes measure the deformed shoes against the floor. Floor recovery also measures the body and clothing. A run or jump retains its airborne phases.

From the repository root, make a take for any resident. The output contains the keyed action and named event markers.

```sh
blender -b --python-exit-code 1 -P 'Character Sources/tools/play_event.py' -- \
  AH-R0001 dodge hurt walk knockdown recover --output /tmp/ida-recovery.blend
```

A hurt resident favors a leg on the next walk or run. A resident who has fallen stays down through a walk request. Recovery brings them back to their feet with the injury retained. A later recovery event clears it. Pass `--from-scene /tmp/ida-recovery.blend` on a later invocation to continue from the saved pose, position and injury state. A conversational beat also layers in the resident’s written listening mannerism. The fall is an authored transition made from the floor-recovery poses. Ground contact and injury state operate in the source scene. Live city AI uses its own character controller.

To reproduce the shared library from the original captures, use Python with NumPy, then rebuild the Blender actions. All files produced by the first command are individual take measurements in this directory.

```sh
python 'Character Sources/tools/capture.py' /tmp/resident-bvh
blender -b --python-exit-code 1 -P 'Character Sources/tools/motion_library.py'
```
