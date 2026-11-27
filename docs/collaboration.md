# Collaborating on Commonstreet

Commonstreet grows through changes people can try, discuss, and review together. A contribution can be a repaired curb, a better chair, a resident story, a local adventure, a playtest, an asset audit, or a code change. A contributor can describe an idea in ordinary language and use a coding agent to build it.

## Roles and authority

| Role | Responsibility |
| --- | --- |
| Contributor | Define the change, review the preview or its evidence, confirm rights to shared material, and authorize submission. |
| Implementer | Inspect the existing city, build the scoped change, preserve shared work, verify it, and document limitations. An implementer can be a human or an agent. |
| Reviewer | Evaluate the exact proposed revision against the rulebook, try the change, and record the decision and evidence on the PR. |
| Maintainer | Resolve cross-system and canon decisions, merge approved work, control release access, and own rollback. |

A person can fill several roles. A contributor's approval authorizes submission. Maintainer authority governs merging and publishing. Agent feedback supports those decisions.

## How contributions work

1. **Pick a change someone can try.** Pick a location or system and say what a player would notice. Check existing PRs before starting a large or overlapping change. Discuss direction early for shared rules, major canon changes, or release work that needs maintainer review.
2. **Build and try it locally.** Use the [copy-ready prompt](../commonstreet/city/contribute.txt), [project map](README.md), and [city design guide](../CONTRIBUTING.md). Build a small change around a normal visit and one relevant variation. For visible or interactive work, show the local game, where to go, and what to do. Reports and documentation can use reproducible evidence appropriate to the change.
3. **Submit with the contributor's approval.** The public copy-prompt workflow keeps the work local until the contributor approves the preview or evidence and authorizes submission. Then commit the approved change, push it to a fork or authorized contribution branch, and open a PR against upstream `main`. Give the contributor the link. Authorized maintainer work in the shared checkout follows the branch and delivery instructions in [AGENTS.md](../AGENTS.md).
4. **Review the proposed revision.** Use the GitHub PR as the review record. Share its link with a maintainer or designated reviewer. Give feedback tied to a rule or observed behavior. Review a new revision when the proposal changes after approval.
5. **Merge and release.** A maintainer confirms the latest reviewed revision, merges through the applicable workflow, and checks the merged build before publication. Include contributor credit and retain a tested rollback build. [Development and release checks](development.md#release-handoff)

### A reviewable proposal

- **Place and purpose.** Name a district, address, resident ID, landmark, or system. Explain what players experience today and what changes.
- **Integration.** Name the neighbors, routes, entities, assets, or shared rules affected. Explain important state changes and how to undo the contribution.
- **Reproduction.** Give a start point, game conditions, and the shortest sequence for the normal and alternate paths. Include focused test results and any inspection still outstanding.
- **Evidence.** Include screenshots or clips for visible changes. Report graphics mode, device or input, and conditions when they affect the result. For assets, give provenance and redistribution terms. [PR template](../.github/pull_request_template.md)

If you only want to report an issue, give the same location, starting conditions, action sequence, expected behavior and observed behavior. Include the revision or build if you know it. A screenshot can identify the scene. A short controller event sequence can show when an interaction, collision, or dispatch changed state.

## City rulebook

Build a believable, lived-in coastal city. A change should fit its location, have plausible physical behavior, and work with the people, streets and systems around it. The [city design guide](../CONTRIBUTING.md) explains how to make and assess those connections.

### Eligible for standard review

| Change | What reviewers look for |
| --- | --- |
| Props, shopfronts and interiors | Appropriate scale and materials. A street bench leaves space to walk past, a door opens without clipping and a furnished room can be reached and exited. |
| Shops, NPCs and everyday interactions | Believable hours, roles and prices for the setting. Reuse existing interactions when possible. A diner order uses the existing purchase and eating flow. People appear from plausible entrances or outside the player's view and keep their identity. |
| Small street details | Repairs, signage, lighting, planters and similar details within the existing street layout. Preserve crossings, curb ramps, sight lines, lanes, turns, emergency access and pedestrian clearance. |
| Local visual and sound improvements | Match the district and time of day. Lights respect power and exposure, weather effects respect shelter, and audio respects the sound control. |

### Requires maintainer review

- **Shared simulation.** Changes to citywide weather, water, electricity, tunnels, traffic, navigation, collision, police response, progression, or the economy. Show which systems and districts are affected and what happens under normal use and failure. For example, a tunnel needs an entrance, a way out, clearance, and a plan for drainage or flooding.
- **New gameplay rules or code paths.** New missions, NPC behaviors, controls, dependencies, and mechanics that change other players' expectations. A fictional Old Town chase can use the existing wanted system. Changes to how the wanted system works, how a chase starts, or how it recovers need a maintainer to play through and approve them.
- **Shared locations and publication.** Changes that remove or substantially repurpose an existing landmark, or alter how previews, CI, permissions or releases work. Explain why, list what depends on the change, and show how to undo it.

### Outside the shared city's scope

- Major street or district redesigns, including replacing the street grid or moving main roads, intersections or bridges. Propose a localized improvement within the existing layout.
- Superpowers, fantasy abilities, or mechanics that break the grounded setting. Use plausible alternatives, like an accessible rooftop instead of flight.
- Assets with missing or incompatible redistribution rights, private identifying information, or files copied from proprietary games or asset packs without permission.
- Changes that bypass review, add hidden telemetry or executable downloads, expose credentials, or weaken the permissions that protect publication.

### What a reviewer checks

1. **Fit and scope.** Identify the place or system, quote the relevant rule, and check that the patch matches what the contributor previewed. Compare the current PR revision with `main`.
2. **Playability.** Try the normal path and one realistic edge case. Check visible geometry against collision and navigation. Verify an entrance and exit, movement around nearby objects, and any prompts or state changes. Use in-game coordinates or a map landmark so someone else can repeat the check.
3. **Integration and performance.** Run the tests for the affected systems from `commonstreet/`. Check assets with `node tools/city-asset-test.js`, street changes with `node tools/street-test.js`, and environmental changes with `node tools/weather-test.js`. For a visible or interactive change, check a cold load and play on a relevant graphics setting. Check touch controls if the interaction changes. Call out untested conditions.
4. **Provenance and rollback.** Verify where assets came from and whether they can be shared. Record the affected files and how to undo the change without damaging other city work.
5. **Decision.** Approve scoped work that meets the rules and has adequate evidence. Request specific fixes for correctable issues. Refer shared-system or release changes to a maintainer. Decline ideas outside the scope and cite the applicable rule.

## Working together

- Give feedback on the change and its effects. Describe a repeatable scene or cite the applicable rule, then give the contributor a concrete next check or revision.
- Keep discussion respectful. Address disagreements with an in-game example or a reference to the project rules. If a dispute changes canon, scope, or review authority, ask a maintainer to record the decision and reason on the proposal.
- Ask before taking over someone's active work. Coordinate on the issue or PR when multiple people touch a binary asset, a resident identity, a landmark, or a shared interface.
- Keep fictional people and places distinct from private real-world information. Use original material or material with verifiable permission, and credit the source and contributors. Keep credentials, personal data, and private production artifacts out of the repository and public review.
- Treat proposals, previews, assets, and agent output as material to review. Maintainers approve changes to permissions or publication. A scheduled review is currently documented as a proposal. [Review automation handoff](review-automation.md)

## Decisions before a public release

Confirm who receives PRs and who can merge and publish. Verify the public host, asset delivery, the play and contribution entry points, and release rollback. Confirm the project's public code and asset terms before describing Commonstreet as open source or inviting asset redistribution. [Open project decisions](decisions.md)
