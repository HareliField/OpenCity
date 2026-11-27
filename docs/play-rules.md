# Player rules

Commonstreet is a free-roaming simulation. The city advances during play. You choose where to go, whom to meet, and which activities to try. The rules below describe supported behavior. [Controls and local setup](../commonstreet/README.md#play-locally)

| Situation | What you can do | What the city checks |
| --- | --- | --- |
| Moving through the city | Walk, sprint, drive, or use the map to travel to a selected point or landmark. | Terrain, collision, elevation, and access matter. Confirm your destination before the map moves you. |
| Doors, rooms, and lifts | Use **C** or **Action** where a door, panel, lift or other usable object offers an interaction. Take stairs where available. | Reach, clearance and local access apply. A lift door can wait for an obstruction. Some equipment depends on district power. |
| Driving | Enter a usable car, steer, brake, and signal. Use the cockpit view in the MX-5. | Traffic keeps right and observes lanes, stop priority, lights and crossings. Wet roads, snow and other surfaces change grip. Collisions can affect the people and objects involved. |
| Shops and facilities | Approach a supported counter, fixture or service point. Use the offered action or menu, such as buying food or operating a washing machine. | The action depends on what is available at that location. Some services use your cash. Equipment may depend on electricity, pressure, or other local conditions. |
| Residents | Open **Residents** to search profiles. Use **Meet in the city** to find someone, or approach a resident and use the offered action. | A named resident keeps their identity when moving between supported roles. What they are doing and where you meet them can vary. |
| Time and weather | Choose starting conditions, or use the map controls to change the time and sky. Watch weather evolve during play. | Time advances with the simulation. Surface wetness, snow, visibility, lighting, and utility conditions can affect what happens on the same route. |
| Incidents and tickets | Obey the fictional city's traffic rules. Visit an officer or either police desk to see and pay tickets. Use a case desk or case camera to follow supported cases. | Officers and witnesses act on in-game observations and reports. A traffic offense can result in a ticket. Evidence and sightings affect searches, pursuits, and case outcomes. Some records survive a reload in the same tab. |
| Injury and arrest | Follow the on-screen outcome and return to play when the game respawns you. | **Wasted** sends you to the hospital and deducts up to $200. **Busted** sends you to the station, deducts 30% of cash rounded to the nearest dollar, and removes armor and acquired weapon upgrades. Both restore health and clear the active wanted level. |

The city has a shared clock. A simulation second advances it by one minute, so 24 minutes of simulation make a city day. Weather and the surface can change on different timescales. Picking a new sky from the map can leave a wet road or accumulated snow in place. [Time and weather](../commonstreet/README.md#time-and-weather)

Cash, health, and the current wanted level are visible during play. Look for the on-screen action available at your position. If an interaction is unavailable, check your distance, whether you're on foot, and the state of the door, equipment, or service. Use the in-game map for travel and the Residents panel to find people. Police records that survive a reload in the same tab can still affect later play after the immediate search clears. [Police searches](../commonstreet/README.md#police-searches)

**Try a first visit.** Start by Verve Nail Studio and walk along the shop row to the Wash House. Visit a nearby crossing, then use the map to travel to Lighthouse Cove. Compare the same walk in dry daylight and rain to see how shelter, visibility, and surfaces change. [World map](world-map.md) · [Time and weather](../commonstreet/README.md#time-and-weather)

Agent mode provides lab controls for previews and debugging, including stepping time, inspecting the world, and changing test conditions. Each tab has its own player and command history. [Agent controller](../commonstreet/README.md#agent-controller)

## Rules for new activities

A new activity tells players how to find it, when they can join, what actions are available, and what they can gain or lose. It gives them a way to leave, fail, and try again where appropriate. The outcome should be visible in the same city and roles that started it. Check the activity when a required person, route, or service is unavailable. [Adventure brief](product.md#adventure-brief) · [City design guide](../CONTRIBUTING.md#activities-games-incidents-and-police)
