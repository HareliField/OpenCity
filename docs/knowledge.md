# Maintaining project knowledge

Commonstreet's docs are part of the change that makes the city work. A future contributor should be able to find a decision, reproduce a bug, and apply an explicit project preference from the repository.

## Where to record knowledge

| What you learned | Put it here |
| --- | --- |
| A lasting instruction or user preference for agents | The nearest applicable `AGENTS.md`. Use the root for project-wide rules. Record the smallest instruction that preserves the intent. |
| A supported behavior, command, name, procedure, or source of truth | The owning guide, code-adjacent README, or data description. Use the [project map](README.md) to find it. |
| A verified pitfall or surprising behavior with a reusable check | The relevant owning guide, or the lesson index below if it spans multiple areas. Give the symptom, what was learned, and how to verify it. |
| A durable choice that changes future work | The owning guide's current rule and, when the rationale or alternatives matter, an entry in [project decisions](decisions.md). |
| An unresolved choice, hypothesis, or incomplete check | The PR or issue for the specific change. Put project-wide decisions in [project decisions](decisions.md) with their status and the information needed to resolve them. |

Keep the writing small and specific. A note like “grade roads need arc-length samples” needs an owner and a way to check it. If the evidence only covers one device, graphics mode or scenario, name it. Record explicit corrections as instructions when they are meant to last. Keep private context, credentials, and out-of-scope personal preferences out of shared docs.

## Close the loop on each change

1. **Read the owning guide first.** Compare its contract to the implementation and the requested change. Flag a true discrepancy in your evidence and correct it in scope.
2. **Update the closest source.** Change the relevant instruction, command, test route or model description in the same patch. Link back from the nearest index when somebody would otherwise miss the change.
3. **Save a new lesson when it can prevent repeat work.** Write what happened, the condition that matters, the action to take, and a source pointer such as a commit, PR, file or reproduction. Add a scope or status when a limitation matters. Routine task narration belongs in the change history.
4. **Consolidate or retire stale guidance.** When a lesson becomes a stable rule, move its action to the owning guide and leave a link to the supporting evidence. Update an invalid assumption. Keep a superseded decision only if its rationale helps with future work.
5. **Verify the next person's route.** Read the changed instructions as a newcomer. Check headings, relative paths, commands and ownership. In the handoff, mention the docs or instructions whose meaning changed.

## Lessons from the city

| Lesson | Where to apply it | Evidence |
| --- | --- | --- |
| Verify the first walk when placing sidewalk props near the spawn. Keep the default start and agent-mode start on the same coordinates. | For spawn and shop-row changes, check both Play and the agent's `start` destination. Inspect `STREET_START` in [main.js](../commonstreet/js/main.js). | Commit `5f0fc036` moved the opening walk clear of a tree and reused the same start for both entry paths. |
| Measure slow-frame behavior across the opening and normal play when adjusting Auto graphics. Persistent overload can need a bigger quality change than a resolution reduction. | Check the manual override and the automatic path in [main.js](../commonstreet/js/main.js). Record the starting quality and observed transitions. | Commit `91690d53` shortened the sampling window and let severe overload go directly to Low. |
| A nearby response unit can be facing away or stuck in a traffic queue. A clear curb approach affects whether it can reach the scene. | When testing dispatch, include an obstructed route and observe approach choice, disembarkation, and the return to service. [System owners](architecture.md#system-ownership) | Commit `44223cd5` changed approach scoring and allowed officers to continue a search on foot from a queue. |
