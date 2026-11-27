# Local tools and verification

Read the relevant [development and verification](../../docs/development.md) section for the local server, Node checks, or release preview.

- Preserve loopback serving, the game-directory root, source reload behavior and compressed GLB fallback when changing `serve.py`.
- Run focused checks using the actual shipped runtime where the check supports it. Check both the normal entry point and the alternate condition a bug fix or feature needs.
- For generators, read the owning source guide first. Prefer rebuilding the smallest affected set and inspect generated paths, references, and binary changes before staging. Close over the required manifest or placement changes when they are part of the same output.
