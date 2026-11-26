# Asphalt Heat

An original browser-based 3D coastal city. The 16 × 16 city blocks cover 1,024 × 1,024 metres, and the freight terminal extends south from the warehouse district. Two graded roads add a second level and a curved route across the grid. Explore after a rain shower, pull over to visit the shops, or head east to the boardwalk and lighthouse.

## Play locally

From the game directory, run:

```sh
python3 tools/serve.py
```

Open [Asphalt Heat](http://127.0.0.1:8765/index.html). Daylight is the default. Add `?light=sunset` for the original evening sky. The game and its assets load locally. Add `?q=0`, `?q=1`, or `?q=2` to override automatic quality selection.

| Action | Desktop |
| --- | --- |
| Walk or drive | Arrow keys |
| Open or close a door, enter or exit a car, or nudge a prop | C |
| Brake while moving | Down arrow. Release and press again to reverse |
| Sprint or use the handbrake | X |
| Punch or shoot | Space |
| Look around | Drag the view |
| Cycle follow, low, and aerial cameras | V |
| Hide or restore the HUD and world markers | H |
| Cycle weapons | Z |
| Exit a car beside a garage service or shutter | E |

Touch devices show an on-screen stick, action controls, camera and HUD buttons. To sell or respray a car, open the garage shutter, stop on the marker inside, and press the action button.

## Places to look

- **Nail studio and shop row.** The game starts by Verve Nail Studio and the maroon coupe. Follow the same sidewalk to Paper & Pine Books, the brick passage, Night Shift Donuts, and the Wash House.
- **Bank and downtown avenue.** Cross the park on its diagonal paths or loop around the fountain. The bank across the avenue has climbable stone steps.
- **Residential streets.** Head west from downtown for tile-roof houses, picket fences, and parked cars. Look for the three covered front porches on the quieter side street.
- **Harbor Viaduct and Coast Ridge Road.** Follow the green ramp signs in the southern half of the city. The viaduct runs east–west above the street. Coast Ridge Road bends through the greenway and crosses above the viaduct’s eastern ramp.
- **Barber and beaches.** The barber is on the palm-lined avenue east of downtown. Take the boardwalk steps down to the umbrellas at Pier Beach, or follow the shore south to the benches and rocks at Lighthouse Cove.
- **South Shore Harbor.** The small private marina sits on the boardwalk south of Lighthouse Cove. It has three timber docks, four moored boats and a stone breakwater. Look for the anchor on the minimap when you get close.
- **Port of Asphalt.** Take either signed gate south from the warehouse district. Follow the marked truck lanes to the container yards, rail loading sidings and quay, where four cranes move cargo beside two berthed ships. Look for the container symbol on the minimap.

## Streets and traffic

The Verve Street intersection at Studio Boulevard has mast-arm signals, pedestrian countdowns and a setback stop bar. Walk one block south for a priority intersection. Drive west to Juniper Street for the residential speed hump, or east to Breakwater Way for the parking-protected, two-way cycle track.

The city uses right-hand traffic. Four-lane avenues carry through traffic, collectors have marked parking bays, and neighborhood streets use two-way or all-way stops. Drivers choose an appropriate lane before turning, signal, queue by bumper distance, yield on permissive left turns and wait for people using the crossing. Signals run an offset 60-second cycle with a pedestrian head start, amber and all-red clearance. On the waterfront, parked cars and a raised buffer sit between the traffic lanes and the cycle track.

Street geometry uses metres. The midblock pavement drains from a 2% crown toward curbside catch basins. A neighborhood hump rises 76 mm over 3.66 m. The wheel collision surface follows the visible profile through the hump, utility repairs, driveway aprons and curb ramps. Selected retail and residential corners extend into the parking strip to shorten the crossing.

**Municipal drawings used for the game**

- Seattle standard plans 436a and 712 informed the hump profile, 3.05 m crosswalk, stop-bar widths and setback. [Construction drawings](https://www.seattle.gov/documents/Departments/SPU/Construction-Resources/standards-guidelines/specifications-plans/2026-Standard-Plans.pdf)
- Seattle's Alaskan Way sheet RS1 informed the order of the cycle track, buffer, parked cars and motor lanes on Breakwater Way. The game fits that arrangement into its 16 m roadway. [Alaskan Way typical sections](https://www.seattle.gov/documents/departments/sdot/bikeprogram/alaskan%20way%20pbl/alaskan%20way%20safety_100percent.pdf#page=7)
- New York's pole elevations and curb-extension details informed signal hardware and the extended corners. San Francisco's intersection plans informed parking setbacks, crossing visibility and ramp placement. [NYC pole drawings](https://www.nyc.gov/html/dot/downloads/pdf/nycdot-street-lighting-standard-drawings.pdf) · [NYC curb extensions](https://www.nycstreetdesign.info/geometry/curb-extension) · [San Francisco intersection design](https://sfbetterstreets.org/design-guidelines/intersection-design/index.html)

The civilian fleet includes original procedural models inspired by the Honda Civic, Toyota Corolla, Prius and RAV4, Volkswagen Golf GTI, MINI Cooper, Ford Mustang GT and F-150, Mazda MX-5, Porsche 911 Carrera, Volvo 240 Estate and Jeep Wrangler. Each has its own body proportions, wheelbase and lamp pattern. The name appears beneath the speedometer while driving.

Run `node tools/street-test.js` to check intersection priority, pedestrian phases, vehicle queues, parking lanes, road surface contact and fleet geometry.

## Market Street and the service gallery

Tideline Market sits one block east of the starting shop row. Harbour Bakery shares its ground floor. Use **C** at the fruit or bread counter to buy food. The maroon four-door saloon is in the marked bay behind the market.

Enter Market Flats through the west door. The stairs and lift connect the cellar, shops, flats and roof terrace. Use **C** inside the lift to travel to the displayed floor, or use the panel beside a landing to call it. The cab carries loose objects on its moving collision deck. A person or a load in the doorway holds the doors open. Ferry Street Rooms in the west, Foundry Lofts near the warehouses, and Seabright Court near the beach each have their own shop, upper floors and roof access. Harbour Supply in Foundry Lofts sells a portable work light for use in the service gallery.

The dry ledge in the cellar gallery crosses under Studio Boulevard to Tidewater Pump House. The power switch operates the market registers, lift and service lighting. The water valve controls tap pressure. The drain pump changes the storm sump level. Running a basin in the flats sends water into the separate sanitary line and its sight gauge.

Buried water mains, electrical ducts and sanitary returns serve all 256 blocks. Four labelled district breakers on the pump house’s south wall operate the street lighting, nearby shop lights, and lifts on their feeder. Water pressure falls with distance and floor height. Flow from running taps on the four residential sites returns along the sanitary branches to the plant. The simulation tracks those fixtures and their service connections.

## Driving, buildings, and assets

Vehicles use a 90 Hz physics step, individual suspension and wheel contact, separate steering angles for the front wheels, and different traction on wet roads, concrete, and sand. Store entrances, house doors, and warehouse shutters open and close on real collision shapes. Many loose objects, including salon chairs and street bins, move when pushed. Trunks, counters, fences, poles, fountains, and railings are solid. Avatar falls use articulated constraints.

The coupe bench test measured 6.00 seconds to 100 km/h and 37.0 metres to brake from that speed. Release the accelerator to slow down gradually, or hold the down arrow for firmer braking.

Run `node tools/ptest.js` to check acceleration, braking, steering, curbs, wall collisions, surface traction, object toppling, and consistency across update rates.

Reviewed GLBs load as the player approaches. Their source models were generated with Meshy 7.1 Ultra 4K geometry and 4K PBR textures. The game uses lighter versions of those files. The featured shop rooms, entrances, furniture, streets, and vehicles have 3D geometry. Upper window interiors and distant storefronts use shaders, and vegetation combines 3D branches with foliage textures.

## Police department

Add `?visit=police` to the game URL to start facing Old Town headquarters. Both police buildings on the minimap share one department. Enter either building and use **C / CASE DESK** at reception to see cases, fugitives, the watch roster and the radio log. The 48 named staff rotate across three watches. Patrol, Detectives, Metro SWAT, Communications, Forensics, Air Support and Command draw from that roster. Approach an officer on foot and use **TALK** to see their name and assignment.

At reception, **Watch** lists the current shift. Use the lobby lift for Investigations & Evidence, Watch Operations, or Staff & Equipment. The evidence terminal tracks each exhibit from collection to storage. Booking and equipment desks show linked bookings and the kits issued to the current watch.

The **Cases** desk offers three playable training reports. Follow a homicide from the first call to a supervisor’s bulletin, follow a gunfire report with an unidentified shooter, or open two homicides together and see how the detectives share one analyst. The files advance on the game clock while you explore. Their timelines record the sender, recipient and finding. Dispatch stays silent during play.

Homicides, robberies, gunfire and vehicle thefts create case files. A civilian can call 911 about gunfire they hear. An identified shooter can trigger a pursuit. A detective takes the file and the evidence desk reviews game-world prints, DNA, witness statements and vehicle sightings. The **Gloves** button changes the character’s hand covering. A homicide bulletin can survive a search cooldown and a reload in the same browser tab. A patrol that recognizes the person or a reported plate can reopen the search. Booking updates linked files at both desks.

## Police searches

Property damage generates a misdemeanor report when a witness sees it. Civilians take a few seconds to complete the call. Police search the scene and the last confirmed location, and losing sight of the player starts the cooldown. Levels 1 and 2 use investigation behavior. Each incident has a limited ground and air response.

| Wanted level | Time out of sight before losing a star |
| --- | --- |
| 1 | 12 seconds |
| 2 | 24 seconds |
| 3 | 25 seconds |
| 4 | 40 seconds |
| 5 | 60 seconds |

Credits include Microsoft Rocketbox avatars (MIT), Poly Haven textures and sky (CC0), three.js, and cannon-es.

## Agent controller

Start the local server and open [agent mode](http://127.0.0.1:8765/index.html?agent=1) in your own Codex in-app browser tab. Press **Play**, verify **Sound off**, and expand **Agent controller**. Enter a JSON object and select **Run command**. Each tab has its own player, simulation clock and command history.

| Task | Example command |
| --- | --- |
| Discover commands or read the current player, camera, HUD, menu and available actions | `{"op":"help"}` or `{"op":"observe"}` |
| Find destinations and jump there on foot or with the current vehicle | `{"op":"places"}`, then `{"op":"jump","to":"harbor"}` |
| Jump to coordinates facing south | `{"op":"jump","x":256,"z":320,"yaw":0}` |
| Walk or drive forward for half a second | `{"op":"step","forward":1,"ticks":15}` |
| Turn, sprint or handbrake, fire, or look around | `{"op":"step","ticks":5,"turn":0.5,"sprint":true,"fire":false,"lookYaw":0.3}` |
| Use the current interaction or a listed menu action | `{"op":"act","action":"interact"}` |
| Find the nearest doors, people, vehicles, props, pickups, helicopters, junctions or blocks | `{"op":"world","group":"doors","radius":40,"limit":10}` |
| Inspect cases, evidence, police staffing and radio calls | `{"op":"police"}` |
| Set up a test with health, armor, money or a wanted level | `{"op":"stats","health":100,"armor":50,"cash":1600,"wanted":2}` |
| List vehicle models and spawn one in a clear nearby lane | `{"op":"models"}`, then `{"op":"spawn","model":"sport"}` |
| Read timestamped commands, messages, damage, collisions, dispatch and errors | `{"op":"events","after":0}` |
| Resume real-time play or pause for inspection | `{"op":"clock","paused":false}` or `{"op":"clock","paused":true}` |

One tick advances 1/30 second. A step accepts 1–120 ticks and releases its inputs when it finishes. Forward and turn range from −1 to 1. Coordinates are metres, with +x east and +z south. Angles are radians. An optional jump `y` selects a surface at an overpass. Jump returns the actual landing position after collision adjustment and one settling tick.

World queries sort by distance and return a `nextOffset` for the next page. Entity IDs are stable within a session. For a bug report, capture the starting observation, run the commands, then request events after the starting `cursor`. The last 512 events are retained. `missed` counts older entries that expired. Random traffic and pedestrians can differ between launches.

The panel and `window.asphaltAgent.run(command)` use the same dispatcher. Browsers with WebMCP support also expose the page tool `asphalt_heat` with a `command` object.
