# Asphalt Heat

An original browser-based 3D coastal city. The street grid grew from 8 × 8 to 16 × 16 blocks, with a playable footprint of 1,024 × 1,024 metres. Two graded roads add a second level and a curved route across the grid. Explore after a rain shower, pull over to visit the shops, or head east to the boardwalk and lighthouse.

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
- **South Shore Harbor.** Stay on the boardwalk south of Lighthouse Cove to reach three timber docks, four moored boats and a stone breakwater. Look for the anchor on the minimap when you get close.

## Driving, buildings, and assets

Vehicles use a 90 Hz physics step, individual suspension and wheel contact, separate steering angles for the front wheels, and different traction on wet roads, concrete, and sand. Store entrances, house doors, and warehouse shutters open and close on real collision shapes. Many loose objects, including salon chairs and street bins, move when pushed. Trunks, counters, fences, poles, fountains, and railings are solid. Avatar falls use articulated constraints.

The coupe bench test measured 6.00 seconds to 100 km/h and 37.0 metres to brake from that speed. Release the accelerator to slow down gradually, or hold the down arrow for firmer braking.

Run `node tools/ptest.js` to check acceleration, braking, steering, curbs, wall collisions, surface traction, object toppling, and consistency across update rates.

Reviewed GLBs load as the player approaches. Their source models were generated with Meshy 7.1 Ultra 4K geometry and 4K PBR textures. The game uses lighter versions of those files. The featured shop rooms, entrances, furniture, streets, and vehicles have 3D geometry. Upper window interiors and distant storefronts use shaders, and vegetation combines 3D branches with foliage textures.

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
