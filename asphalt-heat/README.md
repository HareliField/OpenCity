# Asphalt Heat

An original browser-based 3D coastal city. The 16 × 16 city blocks cover 1,024 × 1,024 metres, and the freight terminal extends south from the warehouse district. Two graded roads add a second level and a curved route across the grid. Follow a storm across the waterfront, pull over to visit the shops, or head east to the boardwalk and lighthouse.

## Play locally

From the game directory, run:

```sh
python3 tools/serve.py
```

Open [Asphalt Heat](http://127.0.0.1:8765/index.html). Morning is the default. Open **Time & weather** before pressing **Play** to pick a starting sky and hour. The game and its assets load locally. Add `?q=0`, `?q=1`, or `?q=2` to override automatic quality selection.

| Action | Desktop |
| --- | --- |
| Walk or drive | Arrow keys |
| Open or close a door, enter or exit a car, or nudge a prop | C |
| Brake while moving | Down arrow. Release and press again to reverse |
| Sprint or use the handbrake | X |
| Punch or shoot | Space |
| Look around | Drag the view |
| Cycle follow, low, aerial, and the MX-5 cockpit camera | V |
| Signal left or right | [ or ]. Press the same key again to cancel |
| Hide or restore the HUD and world markers | H |
| Cycle weapons | Z |
| Exit a car beside a garage service or shutter | E |

Touch devices show an on-screen stick, action controls, camera and HUD buttons. To sell or respray a car, open the garage shutter, stop on the marker inside, and press the action button.

## Time and weather

One real second of play advances the city clock by one minute. A full day takes 24 minutes of simulation. The fictional coast sits at 40° north. The starting season follows the calendar, and sunrise, sunset and shadows move with the day of the year. The moon has its own rising time and phase. The sun travels from east (+x) to west, with south along +z. [NOAA solar position equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)

The city normally starts with scattered clouds and damp streets. Fronts move gradually through clear skies, overcast, sea fog, drizzle, rain and thunderstorms. Cold air brings mixed precipitation, snow and blizzards. Rain collects along gutters. Exposed pavement and roofs hold snow, which melts into water as the air warms. Traffic slows in poor visibility and tyres lose grip on wet or snowy surfaces. Streetlights still depend on their district feeder. Headlights also respond to daylight, fog and precipitation.

For a particular scene, choose **Sunset** and **Thunderstorm** on the title screen, or launch with `?light=sunset&weather=storm`. For a winter night use `?hour=23&weather=snow`. Starting conditions evolve during play. Storms illuminate the clouds and thunder arrives later according to strike distance. Weather audio follows **Sound**, which starts off. [National Weather Service on thunder](https://www.weather.gov/safety/lightning-science-thunder)

Snow catches on tree crowns and parked cars. Driving sheds it from the bodywork. On the beach, breaking waves wash snow away at the waterline, and stronger winds build whitecaps farther out. The lighthouse optic brightens as daylight or visibility falls and follows its local power switch.

Shore materials use the same `climateUniforms` as the sky. `uSun` points toward the sun in world space, `uSunlight` gives its cloud-filtered linear RGB, and `uWind` gives eastward and southward wind in metres per second. `uWindSpeed` follows the gusts. Run `node tools/weather-test.js` to check seasonal fronts, storm timing, melt, drying and shelter.

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

At all-way stops, drivers release in arrival order. Tied arrivals yield to traffic on their right, and a left-turning driver waits for conflicting through traffic. A blocked receiving lane holds the next car behind the bar. Walkers wait just behind the ramp lip, keep right when passing and clear the crossing at their walking pace. [California Driver’s Handbook](https://qr.dmv.ca.gov/portal/handbook/california-driver-handbook/laws-and-rules-of-the-road/) · [FHWA pedestrian signal intervals, §4I.06](https://mutcd.fhwa.dot.gov/pdfs/11th_Edition/mutcd11theditionhl.pdf)

Street geometry uses metres. The midblock pavement drains from a 2% crown toward curbside catch basins. A neighborhood hump rises 76 mm over 3.66 m. The wheel collision surface follows the visible profile through the hump, utility repairs, driveway aprons and curb ramps. Selected retail and residential corners extend into the parking strip to shorten the crossing.

**Municipal drawings used for the game**

- Seattle standard plans 436a and 712 informed the hump profile, 3.05 m crosswalk, stop-bar widths and setback. [Construction drawings](https://www.seattle.gov/documents/Departments/SPU/Construction-Resources/standards-guidelines/specifications-plans/2026-Standard-Plans.pdf)
- Seattle's Alaskan Way sheet RS1 informed the order of the cycle track, buffer, parked cars and motor lanes on Breakwater Way. The game fits that arrangement into its 16 m roadway. [Alaskan Way typical sections](https://www.seattle.gov/documents/departments/sdot/bikeprogram/alaskan%20way%20pbl/alaskan%20way%20safety_100percent.pdf#page=7)
- New York's pole elevations and curb-extension details informed signal hardware and the extended corners. San Francisco's intersection plans informed parking setbacks, crossing visibility and ramp placement. [NYC pole drawings](https://www.nyc.gov/html/dot/downloads/pdf/nycdot-street-lighting-standard-drawings.pdf) · [NYC curb extensions](https://www.nycstreetdesign.info/geometry/curb-extension) · [San Francisco intersection design](https://sfbetterstreets.org/design-guidelines/intersection-design/index.html)

The civilian fleet includes original procedural models inspired by the Honda Civic, Toyota Corolla, Prius and RAV4, Volkswagen Golf GTI, MINI Cooper, Ford Mustang GT and F-150, Mazda MX-5, Porsche 911 Carrera, Volvo 240 Estate and Jeep Wrangler. They have individual body proportions, wheelbases, wheel finishes, tyre widths and lamp patterns. The arrows beside the model name operate the turn signals. The signal cancels after the driver turns and straightens the wheel.

The green MX-5 is parked beside the starting shop row. Its cockpit view follows the seat and suspension. The driver grips the moving wheel and rests both feet in the footwell. The speedometer reads the car’s measured speed and the tachometer follows the simulated engine pitch. [Mazda MX-5 reference gallery](https://www.mazdausa.com/vehicles/2025-mx-5-miata/gallery)

Run `node tools/street-test.js` to check all 16 speed humps, opposing pedestrian paths, stop priority, blocked exits and tyre clearance through 1,440 intersection movements. Each of the 12 cars drives straight, left and right from all four approaches at five junction layouts with both near and distant traffic simulation. A shared intersection checks vehicle and pedestrian clearance at 30, 60 and 120 updates per second.

The same test sweeps all 1,376 straight ground lanes against the actual bridge decks, rails, supports and signposts. It drives the F-150, panel van and Harbor Supply delivery truck south on Coastal Avenue. Both commercial vehicles also drive over Harbor Viaduct and Coast Ridge Road in both directions.

Run `node tools/roadster-test.js` to check the floor clearance and steering-wheel reach of all 32 character meshes in the MX-5.

## Ferry Street cottages

Between Maple Street and Ridge Road, four blocks each contain six furnished cottages around a shared garden. Enter through the side door facing the garden. Each kitchen tap draws from the water main and discharges to the sanitary return. The window grilles, clay tile edges, gutters and overhead service leads follow the houses in reference 017.

## Vehicle service panels

Stand at the nose of a parked car and use **C** to open the bonnet. On the rear-engined coupe, the engine lid opens at the tail. Inside are the radiator, fan, coolant bottle, battery, rocker covers, manifolds, accessory pulleys and wiring. These mechanical layouts are inferred from vehicle type. On the reference saloons, each window is cut from the fitted shell, with seats and a dashboard behind it. A severe impact can crack the laminated windscreen or shatter an individual side or rear pane. Respray service repairs the glazing. Use **C** at a passenger door’s trailing edge to swing it open.

At the back of the Harbor Supply truck, **C** rolls the cargo shutter along its overhead tracks. Five boarding treads deploy when the door reaches the roof. The treads, cargo floor, body sides, front bulkhead and moving shutter support independent rigid bodies.

## Palm Street, Marina Street and the civic squares

The 24-Hour Diner and Marina Coffee face each other at Palm Street and Marina Street. Use **C** at the diner counter for breakfast or at the café for coffee. The coin box outside sells a newspaper. The graphite saloon is parked on the west curb of Palm Street, between Commerce and Marina. Follow Marina east to Breakwater Way for fruit at Seabreeze Market or an LP at Coastal Vinyl. All four buildings have independent passenger lifts, stairs, upper flats and roof landings.

The 27 upper flats and 24 Ferry Street garden cottages have gravity-fed six-litre cisterns. Flush with **C** in front of a fixture. A filled cistern can discharge with the inlet closed. Restoring pressure refills the tank. The civic squares on King Street, Market Street and Coastal Avenue have tiled basins with limestone spheres. Their jets respond to municipal water pressure and the local electric feeder.

## Dock Street and Lighthouse Cove

Harbor Supply faces Dock Street, just west of Ocean Drive. The front shop and stock yard have separate entrances. Use **C** at the counter to buy a portable work light, beside the loading shutter to raise it, or beside the white truck to drive it out through the lowered curb. The silver sedan is parked on Dock Street and the brick-red crossover on Park Street.

East of Ocean Drive, the keeper’s door opens onto a 96-tread spiral stair. The gallery is 15.77 metres above the beach. Use **C** at its electrical switch to operate the rotating beacon. The lens also follows the southeast district feeder.

## Market Street and the service gallery

Tideline Market sits one block east of the starting shop row. Harbour Bakery shares its ground floor. Use **C** at the fruit or bread counter to buy food. On Foundry Street, the maroon four-door saloon is parked outside Harbor Books & Café, between Riverside Donuts and Coastal Nails. Each shop opens onto its furnished interior.

Enter Market Flats through the west door. The stairs and lift connect the cellar, shops, flats and roof terrace. Use **C** inside the lift to travel to the displayed floor, or use the panel beside a landing to call it. The cab carries loose objects on its moving collision deck. A person or a load in the doorway holds the doors open. Ferry Street Rooms in the west, Foundry Lofts near the warehouses, and Seabright Court near the beach each have their own shop, upper floors and roof access. Harbour Supply in Foundry Lofts sells a portable work light for use in the service gallery.

The dry ledge in the cellar gallery crosses under Studio Boulevard to Tidewater Pump House. The power switch operates the market registers, lift and service lighting. The water valve controls tap pressure. The drain pump changes the storm sump level. Running a basin in the flats sends water into the separate sanitary line and its sight gauge.

Buried water mains, electrical ducts and sanitary returns serve all 256 blocks. Four labelled district breakers on the pump house’s south wall operate the street lighting, nearby shop lights, and lifts on their feeder. Water pressure falls with distance and floor height. Flow from sinks and cisterns returns along the sanitary branches to the plant. At Wash House, use **C** in front of a machine to run a wash. Its intake depends on pressure, its drum needs district power, and its measured discharge joins the sanitary line. The sliding glass cases at Tideline Market open from either side.

## Driving, buildings, and assets

Vehicles use a 90 Hz physics step, individual suspension and wheel contact, separate steering angles for the front wheels, and different traction on wet roads, concrete, and sand. Store entrances, house doors, and warehouse shutters open and close on real collision shapes. Many loose objects, including salon chairs and street bins, move when pushed. Trunks, counters, fences, poles, fountains, and railings are solid. Avatar falls use articulated constraints.

The coupe bench test measured 6.00 seconds to 100 km/h on the default damp road. From 100 km/h the same coupe stopped in 35.4 metres on dry asphalt, 38.2 metres on saturated asphalt and 55.1 metres on snow. Release the accelerator to slow down gradually, or hold the down arrow for firmer braking.

Run `node tools/ptest.js` to check acceleration, braking, steering, curbs, wall collisions, surface traction, object toppling, and consistency across update rates.

Reviewed GLBs load as the player approaches. The city uses Meshy 7.1 source models with 4K PBR textures and a separate editable Blender collection. The latter includes photographed finishes, independently moving equipment, store displays and two levels of detail for the street trees. The runtime shares meshes and materials between instances. The featured shop rooms, entrances, furniture, streets, and vehicles have 3D geometry. Upper window interiors and distant storefronts use shaders, and vegetation combines 3D branches with foliage textures.

## Police department

Add `?visit=police` to the game URL to start facing Old Town headquarters. Both police buildings on the minimap share one department. Enter either building and use **C / CASE DESK** at reception to see cases, fugitives, the watch roster and the radio log. The 48 named staff rotate across three watches. Patrol, Detectives, Metro SWAT, Communications, Forensics, Air Support and Command draw from that roster. Approach an officer on foot and use **TALK** to read their assignment and the biography written for their city resident ID. The same staff profiles are available from **Watch**.

At reception, **Watch** lists the current shift. Use the stairs or lift to visit the detective bureau and evidence lab, the dispatch consoles and watch command, or the staff break room and equipment desk. The evidence terminal tracks each exhibit from collection to storage. Booking and equipment desks show linked bookings and the kits issued to the current watch.

During ordinary play, two pedestrians can get into a dispute over a carried holdall. A bystander can call 911 about a shooting. The caller has to finish the call. Someone who finds the victim later can report the scene without naming the offender.

Dispatch assigns up to five available on-duty patrol officers to a street homicide. The scene lead handles the handover. The others take the witness account, keep incident notes, manage access and help bystanders. Officers arrive by patrol car where they have a usable curb approach, or on foot. An available detective takes the file. A witness identification corroborated by an exhibit can support a bulletin. Inconclusive files stay open.

When an encounter is underway, select **Follow street incident** or press **Y** to watch the people involved, the call desk, the scene investigator and the lab. Select **Return to player** to leave the camera. At reception, **Cases** shows the victim, caller’s statement, exhibit history and decision. **Follow live case** in an active file opens the same camera.

The [Downtown homicide film](films/old-town-homicide.html) follows Toby Lin’s 911 call outside Verve Nail Studio, a five-officer patrol response and Detective Kai Chen’s finding at Old Town headquarters. Eight chapters jump to the recorded events. The same page includes a second, unresolved Old Town case and four in-game photographs of headquarters.

The **Cases** desk also offers three playable training reports. Follow a homicide from the first call to a supervisor’s bulletin, follow a gunfire report with an unidentified shooter, or open two homicides together and see how the detectives share one analyst. The files advance on the game clock while you explore. Their timelines record the sender, recipient and finding. Dispatch stays silent during play.

Homicides, robberies, gunfire and vehicle thefts create case files. A civilian can call 911 about gunfire they hear. An identified shooter can trigger a pursuit. A detective takes the file and the evidence desk reviews game-world prints, DNA, witness statements and vehicle sightings. The **Gloves** button changes the character’s hand covering. A homicide bulletin can survive a search cooldown and a reload in the same browser tab. A patrol that recognizes the person or a reported plate can reopen the search. Booking updates linked files at both desks.

## Police searches

Traffic officers in reflective vests work Verve Street at Studio Boulevard, Juniper Street at Park Street and Coastal Avenue at Elm Street. Marked motor patrols also issue tickets. The roadside speed signs read in mph. The speedometer displays the equivalent limit in km/h.

Officers can cite speeding, running a red light or stop sign, wrong-way driving, driving on the sidewalk or cycle track, entering an occupied crosswalk, hitting someone, and damaging or destroying property. A civilian who sees property damage can complete a 911 call. Each ticket records the offense, location, fine, officer, witness source and observed plate. Approach a traffic officer on foot and press **C** to open **Traffic tickets**, or choose **Tickets** at either police desk. Pay from the player's cash balance. Paid and outstanding records survive a reload in the same tab.

Run `node tools/traffic-ticket-test.js` to check lawful and unlawful crossings, witness calls, crash attribution, duplicate tickets, payment and reload.

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
| Inspect the environment or set the sky and solar hour while preserving ground conditions | `{"op":"environment"}` or `{"op":"environment","hour":17,"weather":"storm"}`. Use `help.weatherTypes` for the available fronts. |
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
