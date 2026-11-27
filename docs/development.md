# Development and verification

Use the [project instructions](../AGENTS.md) for checkout and delivery. The playable tree is `commonstreet/`. Keep the native source directories alongside it when running asset checks or rebuilds.

## Start a local preview

From the repository root, run:

```sh
python3 commonstreet/tools/serve.py
```

The server binds to `127.0.0.1`. Add `--port 8766` if the default port is in use. The entry points are [the game](http://127.0.0.1:8765/index.html), [the contribution site](http://127.0.0.1:8765/city/), and [agent mode](http://127.0.0.1:8765/index.html?agent=1). Play uses the checked-in runtime without an npm install or bundling. Agents follow the [muted browser instructions](../AGENTS.md#launching-and-inspecting-the-game).

Check [tools/package.json](../commonstreet/tools/package.json) when a conversion script imports npm packages. Run `npm ci --prefix commonstreet/tools` from the root if you need those dependencies. The focused checks are launched directly with Node. Asset rebuilding has its own dependencies and entry points in the [Blender library](../Blender%20Sources/README.md) and [character pipeline](../Character%20Sources/README.md).

## Verify the change

Run the relevant command from `commonstreet/`. These scripts exercise specific contracts. Visible behavior, actual browser loading, input placement, and playability still need a game preview when affected.

| Changed area | Focused commands |
| --- | --- |
| Debug controller | `node tools/agent-test.js` |
| Street surfaces, crossings and traffic | `node tools/street-test.js` |
| Driving, vehicle components and fit | `node tools/ptest.js`, `node tools/vehicle-components-test.js`, `node tools/roadster-test.js` |
| Buildings, services and interactions | `node tools/building-construction-test.js`, `node tools/gameplay-test.js` |
| Environment and coast | `node tools/weather-test.js`, `node tools/lighthouse-test.js` |
| Models and resident assets | `node tools/city-asset-test.js`, `node tools/resident-cast-test.js`, `node tools/resident-secondary-test.js` |
| Resident routines and roles | `node tools/resident-test.js`, `node tools/officer-rig-test.js` |
| Police, traffic tickets and cases | `node tools/police-test.js`, `node tools/traffic-ticket-test.js`, `node tools/street-case-test.js`, `node tools/scene-response-test.js` |

For a gameplay or visual change, first use the normal entry point. Start from a known location and try the regular path plus one condition likely to expose a regression. Examples include rain on a ramp, a lift door with an obstruction, or a service with power off and restored. Use agent mode to set up, isolate and reproduce the scene. Record starting conditions, commands and events for a scripted reproduction. Traffic and pedestrians can vary between sessions.

Check a cold load or a second graphics setting when changing streamed assets or rendering. Check touch and keyboard when changing an interaction. For documentation, verify local paths, heading anchors, commands and any moved inbound links. Report the checks you exercised, their results, and the affected behavior you could not verify. [Review evidence](collaboration.md#a-reviewable-proposal)

## Release handoff

The maintainer verifies the proposed revision, merges through the applicable workflow, and verifies the merged preview before publishing. Use the current release configuration and confirm who controls publication.

- Verify the play entry point at `/index.html`, the contribution page at `/city/`, and **Copy agent prompt** on the staged build.
- Verify first load, asset responses, Play, **Sound off**, the map, and the most important changed route or interaction. Use the agent launch rules when checking the game.
- Verify any host-specific behavior the game relies on, including relative paths and compressed model delivery when used. A loopback preview establishes local behavior.
- Publish notes with contributor credit and the source revision. Record the previous tested build and how to restore it without losing later repository work.

[Open release decisions](decisions.md) · [Scheduled review proposal](review-automation.md)
