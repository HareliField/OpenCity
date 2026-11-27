# Playable Commonstreet

This directory is the root served by [tools/serve.py](tools/serve.py). The game starts at `/index.html` and the contributor website at `/city/`. Keep game references relative to this root and verify any new path on the local server.

- Read the [player manual](README.md) section for the behavior you are changing and the [development guide](../docs/development.md#verify-the-change) for focused checks.
- Follow the root [muted browser instructions](../AGENTS.md#launching-and-inspecting-the-game) whenever testing the game. Use the [agent controller](README.md#agent-controller) for reproducible scenes after checking the ordinary player entry point.
- For on-screen changes read the relevant [design system](../docs/design-system.md) section. Check keyboard and touch paths when they are affected.
- Update the player manual or controller reference when a supported control, entry point, or output changes.
