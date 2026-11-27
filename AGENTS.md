# Commonstreet agent instructions

Commonstreet is an original browser-based 3D coastal city built by many contributors. Make changes that fit the people, places, and systems already in the city. Use [the project map](docs/README.md) to find the owner of a topic.

## Shared checkout and delivery

- In Matan's original checkout, work directly on `main`. Use a separate worktree only if Matan explicitly asks for one. Check the branch, status, staged changes, and relevant diffs before editing. Preserve other agents' tracked, staged, and untracked work.
- For authorized work in that checkout, commit your own changes and push to `origin` on `main`. Stage specific files or hunks and inspect the commit. If the remote advances, integrate safely while preserving peer work. Never force-push or reset a shared branch to deliver a change.
- For the public [copy-prompt contribution workflow](docs/collaboration.md#how-contributions-work), preview locally and get the contributor's approval to submit before pushing or opening a PR. Use a fork or authorized contribution branch. Maintainers control merging and publication.
- Serve and verify only what the task requires. Lead your handoff with the result, the checks and limitations that matter, and the commit or PR when applicable.

## Read by scope

Read this file first. For each area you will edit, read the applicable `AGENTS.md` files from the repository root down to that area, including any local override recognized by your tooling. When you cross into another scope, read its instructions then. Read only the linked sections you need. A leaf guide adds local instructions and points to sources that own the detail.

| Task | Open next |
| --- | --- |
| Design or review a contribution to the city | [City design guide](CONTRIBUTING.md) and [city rulebook](docs/collaboration.md#city-rulebook) |
| Find a place, resident, or system | [World map](docs/world-map.md) or [runtime ownership map](docs/architecture.md#system-ownership) |
| Game, shell, browser preview or controller | [Game instructions](commonstreet/AGENTS.md) |
| Simulation, rendering, UI logic or runtime data | [Runtime instructions](commonstreet/js/AGENTS.md) after the game instructions |
| Contribution site or copy-ready prompt | [City website instructions](commonstreet/city/AGENTS.md) after the game instructions |
| Local server, checks or generators | [Tool instructions](commonstreet/tools/AGENTS.md) after the game instructions |
| Resident stories or runtime art | [Story instructions](commonstreet/stories/AGENTS.md), [resident asset instructions](commonstreet/assets/AGENTS.md), or [model instructions](commonstreet/models/AGENTS.md) after the game instructions |
| Editable art or provenance | [Blender](Blender%20Sources/AGENTS.md), [character](Character%20Sources/AGENTS.md), or [Meshy](Meshy%20Sources/AGENTS.md) instructions |
| Docs, onboarding, or project rules | [Documentation instructions](docs/AGENTS.md) and [knowledge maintenance](docs/knowledge.md) |

## Launching and inspecting the game

Launch and relaunch with sound off in a separate Codex in-app browser tab owned by your chat or agent session. Use that browser exclusively. Do not use Chrome, Dia, Safari, or a tab owned by the user or another agent. Press **Play**, verify the in-game button reads **Sound off**, and leave it off. Pass these instructions along explicitly if another agent is asked to launch. If the in-app browser is unavailable, report the blocker and leave the game closed.

For hands-free debugging add `?agent=1`, press **Play**, verify **Sound off**, expand **Agent controller**, and run `{"op":"help"}`. The simulation waits between commands. Use `places` and `jump` to reach a scene, `world` and `observe` to inspect it, and `events` to capture evidence. The [controller guide](commonstreet/README.md#agent-controller) has examples and units.

## Leave the project easier to work on

- When a change affects a documented contract, entry point, command, identity, workflow, or expectation, update the owning documentation in the same change. If the owner moves, repair the nearest index and preserve old inbound links where practical.
- Before wrapping up, ask what a future contributor would otherwise need to rediscover. Record verified lessons, explicit corrections and preferences, and durable decisions where they apply. Cite the change, code, or reproduction. Keep assumptions and pending decisions identifiable. [Where to record knowledge](docs/knowledge.md#where-to-record-knowledge)
- Promote a lesson into `AGENTS.md` when it gives future agents a concrete instruction. Put cross-project rules here and narrow rules in the smallest applicable scope. Keep examples and rationale in linked docs. Add a leaf guide when its directory has distinct recurring constraints.
- Reconcile outdated instructions when you encounter them in scope. Keep one owner for each rule. Treat a one-off request as task context unless the user makes it a lasting preference. Keep private details, secrets, and chat transcripts out of repository documentation.
