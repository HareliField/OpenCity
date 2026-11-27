# Commonstreet

## City contributions

Before designing or editing a contribution, read the [city design guide](CONTRIBUTING.md) and the [city rulebook](commonstreet/README.md#city-rulebook). Locate the change in the existing city, check the people, places, and systems it touches, and verify the result in ordinary play and when a relevant condition changes.

Launch and relaunch the game with sound off. Use a separate Codex in-app browser tab owned by your chat or agent session. Use the Codex in-app browser exclusively for game launches. Do not use Chrome, Dia, Safari, or a tab owned by the user or another agent.

After pressing Play, verify that the in-game button shows **Sound off** and leave it off. Pass these instructions along explicitly when asking another agent to launch or relaunch the game. If the in-app browser is unavailable, report the blocker and leave the game closed.

## Hands-free gameplay and debugging

Every Commonstreet agent can launch its own game session with `?agent=1`. Follow the browser and sound instructions above. Press Play, verify **Sound off**, expand **Agent controller**, and run `{"op":"help"}`. The simulation waits between commands so you can inspect a collision, interaction or police response one tick at a time.

Use `places` and `jump` to visit a landmark or coordinates, `world` to inspect what is there, and `observe` to discover the available player actions. Use `events` to collect the command sequence and game messages for a bug report. The [agent controller guide](commonstreet/README.md#agent-controller) includes examples and units.
