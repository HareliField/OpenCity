# Commonstreet project map

| Topic | Owning document | When to read it |
| --- | --- | --- |
| First visit | [Project README](../README.md) | Start the game or find a way to contribute. |
| Product | [Product direction](product.md) | Choose what to make and understand the scope of the shared city. |
| Playing | [Player rules](play-rules.md), [player manual](../commonstreet/README.md) | Understand actions, limits, consequences, controls, and setup. |
| Geography and canon | [World map](world-map.md), [resident directory](../commonstreet/stories/residents/directory.md) | Locate a place or person and check what already connects to them. |
| Building the world | [City design guide](../CONTRIBUTING.md) | Define how residents, objects, buildings, systems, and activities fit the city. |
| Contributing and review | [Collaboration guide and city rulebook](collaboration.md) | Submit, review, approve, or roll back a contribution. |
| Visual and interaction design | [Design system](design-system.md), [photo comparison index](../Meshy%20Sources/City%20reference%20index.md) | Choose materials, dimensions, UI patterns, and visual evidence. |
| Engineering | [Architecture and stack](architecture.md), [development guide](development.md) | Trace ownership and dependencies, run checks, or plan a release. |
| Production art | [Blender libraries](../Blender%20Sources/README.md), [Meshy sources](../Meshy%20Sources/README.md), [character pipeline](../Character%20Sources/README.md) | Find editable sources and regenerate a scoped export. |
| Knowledge and governance | [Knowledge maintenance](knowledge.md), [project decisions](decisions.md) | Record a durable lesson or check what a maintainer still needs to settle. |
| Agents | [Root instructions](../AGENTS.md) | Start here, then read only instructions for directories you touch. |

## Repository layout

| Path | Contents |
| --- | --- |
| [commonstreet/](../commonstreet/AGENTS.md) | Browser game, UI, player manual, and the static files served by the local game server. |
| [commonstreet/js/](../commonstreet/js/AGENTS.md) | Rendering, simulation, city builders, interactions, and local agent controller. |
| [commonstreet/city/](../commonstreet/city/AGENTS.md) | Contribution landing page, gallery media, and copy-ready prompt. |
| [commonstreet/tools/](../commonstreet/tools/AGENTS.md) | Local server, focused Node checks, Python/Blender exporters, and conversion scripts. |
| [commonstreet/assets/](../commonstreet/assets/AGENTS.md) and [commonstreet/models/](../commonstreet/models/AGENTS.md) | Streamed resident and scenery packages, catalogs, and legacy models. |
| [commonstreet/stories/](../commonstreet/stories/AGENTS.md) | Resident biographies and linked neighborhood episodes. |
| [commonstreet/lib/](../commonstreet/lib/), [commonstreet/tex/](../commonstreet/tex/), and [commonstreet/audio/](../commonstreet/audio/) | Vendored runtime libraries, surface textures, and recorded audio. |
| [commonstreet/films/](../commonstreet/films/) and [Visual Target References/](../commonstreet/Visual%20Target%20References/) | Recorded city scenes and reference images for visual review. |
| [Blender Sources/](../Blender%20Sources/AGENTS.md), [Meshy Sources/](../Meshy%20Sources/AGENTS.md), [Character Sources/](../Character%20Sources/AGENTS.md) | Editable source libraries, production methods, reference comparisons, and receipts. |
| [docs/](AGENTS.md) | Design, engineering, governance, and knowledge guides. |
| [.github/](../.github/pull_request_template.md) | GitHub contribution template. |
| [commonstreet.zip](../commonstreet.zip) | Checked-in snapshot of the game tree. Work from the live source directory above. |
