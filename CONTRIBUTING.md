# Contributing to Commonstreet

Build a believable coastal city whose people have lives of their own. A shop, parked car, back door, or game in the park should make sense on an ordinary day, even when the player never uses it.

Use the [copy-ready agent prompt](commonstreet/city/contribute.txt) to start. The [contribution workflow](commonstreet/README.md#how-contributions-work) covers preview and submission. The [city rulebook](commonstreet/README.md#city-rulebook) sets review scope and limits, including for new mechanics, shared systems, and landmark changes.

## Place the change in the existing city

1. **Pick a real location in the game.** Inspect the map and the nearby block or landmark. Record the street or coordinates, district, floor or frontage if relevant, and how people already use the place. For shared behavior, identify where it applies and which systems depend on it.
2. **Connect it to what is already there.** Identify who owns, lives in, works at, uses, or looks after the addition, as applicable. Check the resident directory, existing businesses and routes, and the systems listed below before adding a new identity, location, or rule. A small prop may only need a plausible purpose and a clear place to stand.
3. **Describe an ordinary day and one relevant variation.** Say who comes from where, what they do, and what changes when a shift ends, the weather turns, a route closes, or a person is away. Use the game clock and specify days when the difference matters. Preserve travel time, opening hours, access, and service availability across related changes.
4. **Follow the state through play.** Where a change has ongoing state, use the existing source of truth and preserve the relevant identity, possession, stock, or outcome when people move, players leave and return, or assets stream out and back in. Document the intended behavior and the part the patch actually exercises. Treat systems missing from the current game as gaps to account for in the proposal.

## Residents, homes, jobs, and personality

- Give a new resident a stable identity, a home or a reason they are visiting, and regular commitments. Connect the home to a specific dwelling or plausible address in the district. Connect work, school, caregiving, appointments, retirement, or other regular activity to a place and people they interact with. Give an existing resident new commitments that fit their established history, family, and work.
- Plan a recognizable day. Specify which city days each routine applies to and use time windows for leaving home, travel, work or other duties, breaks, errands, and returning home. Give different days a reason to differ, such as a Saturday shift, a weekday school run, or a day off. Allow time to walk, park, and change locations. An off-duty, delayed, or unavailable resident needs a believable next activity.
- Use the same person across their home, workplace, dialogue, relationships, and vehicle. Avoid overlapping assignments or showing the same named person in two places at once. Background actor slots may be reused while the named resident's identity stays consistent.
- Let personality affect choices. Give the person something they want, someone they care about, and a characteristic response to an inconvenience. Use those details in dialogue and behavior while keeping them consistent with the resident's story.

## Vehicles, traffic, and streets

- Every vehicle placed or spawned in the city has an owner of record, such as a resident, household, business, rental company, or public fleet. Give each vehicle instance a consistent identity and a reason to be on that route or in that parking spot. A model in the catalog can serve many vehicles. For background traffic, a stable assignment within the supported simulation is enough. Use a fictional organization when a named resident would add no value.
- Track the owner separately from the current driver or keeper. A rental, loan, shift change, tow, or theft can change possession. A sale can change ownership. Keep the same vehicle identity and plate where the game uses plate records. If a vehicle is abandoned, give it an owner of record and a reason it was left there.
- Fit parking, deliveries, and driveways to the buildings and people they serve. Keep the street grid and right-hand traffic. Check lane direction, turn clearance, queues, curb ramps, crossing visibility, pedestrian and cycling routes, and access for service and emergency vehicles. Align the visible surface, wheel contact, and navigation, including on slopes and at raised crossings.

## Buildings, shops, and trade

- Give a building a district-appropriate use, scale, and a reachable entrance and exit. Place tenants and businesses where their daily activity fits. Think through deliveries, stairs or lifts, locked areas, and what happens when a door is shut or power goes out. Keep furnishings clear of walking routes and door swings.
- Define who operates each shop, what it buys or sells, when and where people can trade, how stock arrives, and what happens at closing. Regular staff can have shifts and travel to them. A shop without permanent staff can still trade. A resident can come unlock it and sell during a scheduled shift, or an open business can use a self-service counter, a machine, or another arrangement that fits the goods and place.
- If a shop buys goods, a resident or player can bring an item and sell it through that shop's supported process. For a part-time stall or a visiting seller, give the seller permission to trade there, a time to arrive, and a way to bring and remove stock. Make it clear to players who can buy or sell now. A transaction updates the item, payment, and inventory together, and an unavailable service tells the player when or how to try again.

## Physics, water, weather, and utilities

- Use city scale and the existing simulation for collision, traction, doors, movable objects, and interactions. A visible ledge should support a person where it appears to, a wheel should follow the road profile, and wet or slippery surfaces should affect movement in a consistent way. Check the usual case and an affected edge case, such as a blocked lift door or a wet ramp.
- Give water a source, a route, and somewhere to go. Match the coast, grade, and connected networks. Account for runoff, drainage, sanitary return, pumps, pressure, or flooding where relevant. Keep rain and wind effects consistent with shelter. Link utility-dependent shops, lights, lifts, and equipment to the service they use, with plausible behavior when it is interrupted and restored.

## Activities, games, incidents, and police

- Give an activity or minigame a place, a reason people do it, and a time when it can happen. Define who can join, the rules and stakes, how to leave or finish, and what state carries back into the city. A Saturday park game should have participants, a clear play area, and a way to wrap up when people leave or rain arrives.
- Keep fictional weapons and crime gameplay connected to the existing inventory, access, incident, and response systems. Define their role and consequences in the game. Ground police activity in the existing staff roster, watches, dispatch, and cases. Use what in-game characters actually saw, heard, or reported. Account for unavailable units and unresolved cases. Changes to shared response rules or new gameplay mechanics need maintainer review.

## Find the existing system

Paths in this table are relative to [`commonstreet/`](commonstreet/).

| Area | Inspect first | Relevant checks |
| --- | --- | --- |
| Residents, biographies, and roles | `stories/residents/directory.md`, `assets/residents/cast.json`, `js/resident-cast.js`, `js/wash-house.js` | `node tools/resident-cast-test.js`, `node tools/resident-test.js` |
| Map, streets, and traffic | `js/world.js`, `js/street-plan.js`, `js/street-surface.js`, `js/city-traffic.js` | `node tools/street-test.js` |
| Vehicles and physics | `js/fleet.js`, `js/phys.js`, `js/vehicle-components.js`, `js/game.js` | `node tools/ptest.js`, `node tools/vehicle-components-test.js` |
| Buildings, props, and access | `js/interiors.js`, `js/access.js`, `js/building-construction.js`, `models/scenery/catalog.json` | `node tools/building-construction-test.js`, `node tools/city-asset-test.js` |
| Shops, trades, and activities | `js/main.js`, `js/game.js`, `js/city-services.js`, `js/wash-house.js` | `node tools/gameplay-test.js` and the relevant interaction in the city |
| Weather, coast, water, and utilities | `js/weather.js`, `js/weather-cover.js`, `js/coast.js`, `js/city-services.js` | `node tools/weather-test.js`, `node tools/gameplay-test.js` |
| Police, tickets, and fictional cases | `js/department.js`, `js/dispatch.js`, `js/traffic-police.js`, `js/street-incidents.js` | `node tools/police-test.js`, `node tools/traffic-ticket-test.js`, `node tools/street-case-test.js` |

## Show how it fits

Preview the change using the [agent controller](commonstreet/README.md#agent-controller) in your own Codex in-app browser tab. Press **Play**, verify **Sound off**, and leave it off. Give the contributor a landmark or coordinates, the in-game day and time if relevant, and steps to see the normal behavior and a plausible variation. Include the affected residents or systems, what you verified, any known gaps, and the source and redistribution rights for added assets. For example, show a resident arriving to sell at a Saturday pop-up, then visit outside its hours and check the posted hours and the clear sidewalk.
