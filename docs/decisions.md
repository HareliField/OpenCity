# Project decisions

Record durable decisions here when the reason will matter to future contributors. Give the date, status, scope, decision, rationale, and a source or confirmation. Put the current instruction in the owning guide. Link to the decision from that guide when it helps.

## Current direction

| Decision | Rationale | Owning guide |
| --- | --- | --- |
| Build the shared city inside an established grid and grounded setting. | Small contributions can coexist when the routes, physical rules, and known places remain reliable. | [City rulebook](collaboration.md#city-rulebook) |
| Use previews and PRs for public contributions, with maintainers responsible for release. | Contributors can revise a preview before submitting, and review applies to a known revision. | [Collaboration](collaboration.md#how-contributions-work) |
| Keep agent instructions scoped by directory and route detail to owning guides. | A story edit and a rendering edit need different context. The repository map makes both routes discoverable. | [Agent instructions](../AGENTS.md#read-by-scope) · [Knowledge maintenance](knowledge.md) |

## Open decisions

### Public code and asset terms

The repository has asset-specific provenance and some upstream license records. It has no root license file. A maintainer needs to establish the public terms for project code, original assets, source references, and contributors' submissions before an open-source or redistribution claim. Record the decision in the repository and update the contributor workflow when it is settled. [Character provenance](../Character%20Sources/Anatomy/LICENSE-NOTES.md) · [Meshy sources](../Meshy%20Sources/README.md) · [Rocketbox license](../commonstreet/models/ROCKETBOX-LICENSE.md)

### Public release responsibility

Identify the maintainer review and reporting route, the public host, the release authority, and the rollback owner. Verify the staged entry points and assets. The scheduled review has a documented implementation handoff and awaits setup. [Release handoff](development.md#release-handoff) · [Scheduled review proposal](review-automation.md)

### Player continuity and multiplayer

The game runs in one browser tab with limited browser persistence. Decide the scope of player continuity before promising citywide saves, account-linked progress, or multiplayer. Those choices affect identity, progression, reviews, permissions, and the meaning of a shared city. [Product direction](product.md#what-exists-and-where-to-grow) · [Browser state](architecture.md#state-assets-and-compatibility)
