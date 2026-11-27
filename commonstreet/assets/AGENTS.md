# Runtime resident assets

Use the [character source instructions](../../Character%20Sources/AGENTS.md) and the [resident references](../stories/residents/directory.md) for resident changes. These runtime packages are linked to editable masters and shared resources.

- Preserve the resident ID, cast manifest entries, and relative references across glTF files, buffers, textures, and motion data.
- Use the source pipeline for changes that depend on a fitted character, generated output, or checksum. Scope the rebuild to the affected residents and verify the cast and motion checks that apply.
- Check that a resident loads, moves, and keeps their identity around streaming or contact transitions that the change affects. [Focused checks](../../docs/development.md#verify-the-change)
