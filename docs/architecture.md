# Architecture and technical stack

The game is a browser application served from `commonstreet/`. It loads checked-in scripts, models, textures and audio directly. The contribution site is a separate static entry point at `/city/`. The local game has no application backend or account service.

## Stack

| Layer | What the repository uses |
| --- | --- |
| Game shell and controls | HTML and CSS, a full-screen canvas, and classic JavaScript scripts in the order defined by [index.html](../commonstreet/index.html). Specialized panels have their own stylesheets. |
| Contribution site | HTML and CSS with a browser ES module, video clips, and a plain-text prompt. [Site source](../commonstreet/city/index.html) |
| Rendering and assets | Vendored Three.js r128, GLTFLoader and SkeletonUtils. WebGL draws the scene with WebGL2 enabling additional post-processing. GLB/glTF packages, texture atlases, procedural geometry, and instancing cover different parts of the city. [Runtime libraries](../commonstreet/lib/) |
| Simulation | Vendored cannon-es for rigid bodies and vehicle suspension. JavaScript implements game state, resident behavior, streets, environment, access, utilities and fictional incidents. |
| Audio | Web Audio supplies synthesized game sounds. Checked-in media supplies recorded material. The game sound control starts off. |
| Development | Python loopback HTTP server. Focused Node scripts exercise browser source in a VM and use the shipped libraries where applicable. Conversion tools have a separate npm lockfile. [Development guide](development.md) |
| Asset production | Blender and Python tools for native models and exports. The Meshy source library preserves references, raw generations, and reviewed exports. The character pipeline fits individual assets and packages shared resources. [Production sources](README.md#repository-layout) |

## Runtime flow

1. **Boot.** `index.html` defines the UI and loads libraries and feature scripts. `core.js` establishes the renderer, world constants and graphics settings. `main.js` loads required assets, builds the city, and initializes player and simulation state.
2. **Simulate.** `main.js` advances weather, local geometry, interactions, vehicles, residents, and incidents. `phys.js` consumes accumulated simulation time at 90 Hz. Realtime updates then draw the HUD, map and scene as needed. The loop limits catch-up after a stall.
3. **Stream.** Proximity and graphics settings control what needs to be active. Scenery can reuse mesh and material data. Building fittings and collision are brought into range, and the resident loader shares and releases resources. Keep identity and gameplay state separate from replaceable render instances.
4. **Inspect.** Normal controls, the city map, and the resident and police panels use game state. The opt-in agent controller uses the same simulation and interaction entry points, with 1/30-second command ticks. The session starts paused between commands. [Controller reference](../commonstreet/README.md#agent-controller)

## System ownership

Paths below are relative to `commonstreet/`. Use the script list in `index.html` to check load order before moving or adding runtime code. Look at the focused test for how it loads the same modules.

| Area | Inspect first | Boundary to preserve |
| --- | --- | --- |
| Boot, player, camera and interaction routing | `js/main.js`, `js/game.js`, `index.html` | Input and UI share the existing action resolver. Keep Play, player movement, help and debug entry points consistent. |
| Render, atmosphere and weather | `js/core.js`, `js/weather.js`, `js/weather-cover.js`, `js/atmosphere.js`, `js/precipitation.js`, `js/coast.js` | Weather feeds lighting, shelter, precipitation, traction and coastal materials. |
| Scenery artwork and decoration | `js/scenery-library.js`, `models/scenery/library/`, `js/city-decorations.js`, `world/decorations/`, `js/scenery.js` | A model ID selects artwork. A site record places it. The renderer decides when to show detail. |
| World and streets | `js/world.js`, `js/roads.js`, `js/street-plan.js`, `js/street-surface.js`, `js/street-signals.js`, `js/city-traffic.js` | Road design, collision, elevation, lanes, crossings and routes agree. |
| Vehicles and collision | `js/phys.js`, `js/fleet.js`, `js/cargen.js`, `js/vehicle-components.js`, `js/props.js` | Vehicle definitions, instance state, geometry, moving parts and rigid bodies stay aligned. |
| Buildings and access | `js/interiors.js`, `js/access.js`, `js/building-construction.js`, `js/suite-interiors.js`, `js/fire-escapes.js` | Floors, stairs, doors, lifts and fittings use compatible surfaces and clearances. |
| Shops, networks and fixtures | `js/city-services.js`, `js/city-works.js`, `js/civic-fittings.js`, `js/domestic-fittings.js`, `js/wash-house.js` | Interactions use the relevant service and update the state the rest of the game reads. |
| Coastal landmarks and logistics | `js/lighthouse.js`, `js/dock-yard.js`, `js/freight.js`, `js/harbor.js`, `js/harbor-supply.js` | Preserve grades, entrances, utility connections, cargo clearances and designated routes. |
| Residents and performance | `assets/residents/cast.json`, `js/resident-cast.js`, `js/resident-assets.js`, `js/resident-rig.js`, `js/resident-motion.js`, `js/resident-directory.js` | Preserve person IDs, fit, package references, resource ownership and state across appearance swaps. |
| Police and incidents | `js/department.js`, `js/dispatch.js`, `js/police-world.js`, `js/street-incidents.js`, `js/traffic-police.js`, `js/police-desk.js`, `js/case-camera.js` | Separate records and observed evidence from response logic, active units and presentation. |
| Map and agent access | `js/city-map.js`, `js/agent-controller.js`, `js/main.js` | Use shared destinations and coordinates. Preserve documented commands, units and output fields. |

## State, assets, and compatibility

- **Time and coordinates.** Simulation durations are seconds. One simulation second advances the city clock by one minute. World positions are metres, y is up, +x is east, and +z is south. Agent angles are radians. Include y for a stacked surface.
- **Browser storage.** Graphics settings use local storage, with a legacy key fallback in `core.js`. The department uses session storage for records such as cases and tickets. Test same-tab reload and fresh-session behavior when changing these contracts. A full city save format is an open project question.
- **Asset references.** Use the source library and catalog for each asset. Preserve relative references in glTF and avoid duplicating shared resident buffers or textures. Review loading, rotation, scale, pivots and collision in the browser, with an asset check to catch missing or stale files.
- **Local serving.** The game server decodes a stored `.glb.gz` when its plain `.glb` URL is requested and the plain file is absent. Verify the equivalent delivery path on a release host if it ships those packages. Keep script ordering, relative asset paths and existing local behavior intact when changing hosting.

## Contribution architecture

The [model library](../commonstreet/models/scenery/library/README.md) loads artwork by stable ID. An individual record and GLB can be added without editing a shared catalog. The [model preview](http://127.0.0.1:8765/model-preview.html) and the game use the same loader. In the [placement files](../commonstreet/world/decorations/README.md), Tideline Market references one library model at two positions. The counter and shop logic still live with the market. The renderer streams each appearance by view distance and graphics settings.

The table describes the intended ownership of new contributions. Only static models and decorative placements have the data-only path today. The other boundaries guide gradual extraction from the runtime owners above.

| Owns | Contribution and contract |
| --- | --- |
| **Artwork** | Meshes, materials, textures, levels of detail, pivots and credit. Review dimensions and named attachment points in isolation. An appearance can be reused across many places and entities. |
| **Motion and physics** | Motion clips and rig mappings describe how an object looks in motion. Collision shapes, contacts, mass and traction describe how it moves and supports other bodies. Bind them explicitly when a feature needs both. A moving door needs a hinge, animation and collider that agree throughout travel. |
| **Object types and instances** | An object type composes appearance, motion, physics and supported interactions. An instance owns its durable ID and state, such as placement, registration, ownership or inventory. A visible copy can be rebuilt when streaming resumes. |
| **Terrain, streets and buildings** | Districts, grades, building floors, surfaces, lane and walking graphs, access, water and utility links. Renderers, routing, physics and the map consume shared geography through the same coordinates and place IDs. A terrain edit must preserve their agreement. |
| **Placement, schedules and spawning** | Authored placements choose a transform. Schedules and population rules choose when, where and under what conditions an instance appears. Graphics streaming controls the detail presented to the player. A change in visibility must preserve simulation state. |
| **Rules and activities** | Actions, eligibility, economy, incidents, consequences and completion. Resolve through existing actions and services, using stable entity and place IDs. A mission can compose existing rules and places. A new rule needs explicit integration and review. |
| **Stories, interfaces and localization** | Narrative and dialogue reference stable people and places. The HUD, map, controls, accessibility and translations use exposed game state and action results. These give writers and interface contributors their own entry points. |

Extend the data formats when an existing feature provides a concrete test. Good next examples are a door with separate appearance, hinge and collision, a resident using the same motion in two places, and a site whose schedule changes without a landscape edit. Migrate one representative example at a time and keep it playable through both the ordinary entry point and the agent controller. [Contribution paths](collaboration.md#choose-a-contribution-path)

[Focused checks](development.md#verify-the-change) · [World map](world-map.md) · [Agent runtime instructions](../commonstreet/js/AGENTS.md)
