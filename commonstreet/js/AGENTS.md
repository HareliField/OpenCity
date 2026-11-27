# Game runtime

Use the [system ownership map](../../docs/architecture.md#system-ownership) and read the files and focused checks for the system you touch. [Development checks](../../docs/development.md#verify-the-change)

- Check the classic-script load order in [index.html](../index.html). Some focused tests evaluate the same scripts in a Node VM. Preserve their entry points and the browser entry points used by the game.
- Reuse existing world measurements, shared weather, action resolution, street surfaces, and identity records. Keep metres, axes and time units consistent across rendering, collision, movement and debug views.
- Keep game state tied to stable entities when visuals or physical representations stream out and back in. For stored records, check same-tab reload and fresh-tab behavior.
- When changing a route, prop, door or vehicle, check the visible geometry against navigation and physics under ordinary use and the relevant alternate condition.
- Check what the relevant actor can actually observe when changing fictional incidents and police behavior. Review dispatch changes with both an accessible and an obstructed approach. [Lessons](../../docs/knowledge.md#lessons-from-the-city)
- Keep ordinary interaction and debug paths aligned. When changing start destinations, use the same start definition for Play and agent mode.
