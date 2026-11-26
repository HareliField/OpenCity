# Asphalt Heat

An original browser-based 3D coastal city. The 16 × 16 city blocks cover 1,024 × 1,024 metres, and the freight terminal extends south from the warehouse district. Two graded roads add a second level and a curved route across the grid. Explore after a rain shower, pull over to visit the shops, or head east to the boardwalk and lighthouse.

## Play locally

From the game directory, run:

```sh
python3 tools/serve.py
```

Open [Asphalt Heat](http://127.0.0.1:8765/index.html). The game and its assets load locally. Add `?q=0`, `?q=1`, or `?q=2` to override automatic quality selection.

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

## Driving, buildings, and assets

Vehicles use a 90 Hz physics step, individual suspension and wheel contact, separate steering angles for the front wheels, and different traction on wet roads, concrete, and sand. Store entrances, house doors, and warehouse shutters open and close on real collision shapes. Many loose objects, including salon chairs and street bins, move when pushed. Trunks, counters, fences, poles, fountains, and railings are solid. Avatar falls use articulated constraints.

The coupe bench test measured 6.00 seconds to 100 km/h and 37.0 metres to brake from that speed. Release the accelerator to slow down gradually, or hold the down arrow for firmer braking.

Run `node tools/ptest.js` to check acceleration, braking, steering, curbs, wall collisions, surface traction, object toppling, and consistency across update rates.

Reviewed GLBs load as the player approaches. Their source models were generated with Meshy 7.1 Ultra 4K geometry and 4K PBR textures. The game uses lighter versions of those files. The featured shop rooms, entrances, furniture, streets, and vehicles have 3D geometry. Upper window interiors and distant storefronts use shaders, and vegetation combines 3D branches with foliage textures.

## Police department

Both police buildings on the minimap share one department. Enter either building and use **C / CASE DESK** at reception to see cases, fugitives, the watch roster and the radio log. The 48 named staff rotate across three watches. Patrol, Detectives, Metro SWAT, Communications, Forensics, Air Support and Command draw from that roster. Approach an officer on foot and use **TALK** to see their name and assignment.

Homicides, robberies and vehicle thefts create case files. A detective takes the file and the evidence desk reviews game-world prints, DNA, witness statements and vehicle sightings. The **Gloves** button changes the character’s hand covering. A homicide bulletin can survive a search cooldown and a reload in the same browser tab. A patrol that recognizes the person or a reported plate can reopen the search. Booking updates linked files at both desks.

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
