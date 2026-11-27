# Commonstreet design system

## The 3D city

Use the district's references, existing scale, visible materials, and everyday use. Start with an existing frontage, room, object family, or neighboring block. Decide who would build, buy, clean, repair, or use the object to guide the details.

| Element | Pattern | In-game check |
| --- | --- | --- |
| Scale and placement | Model in metres. Match human reach, floor heights, road grade, and the object's support surface. Leave clearances for a door swing, wheel, stair or passing pedestrian. | Approach on the intended route, use the object, and exit. Compare the visible surface with walking and wheel contact. |
| Materials | Use plausible color, roughness, metal, wear and glazing. Put wear where touch, sun, salt, runoff or traffic would create it. Use district reference photos and preserve variation across neighboring objects. | Review in daylight and the alternate condition relevant to the asset, such as wet pavement, an unlit shop, or a night storefront. |
| Moving parts | Keep hinges, shutters, dials, wheels and animated equipment on their own named parts and pivots. Align rendering, collision and interaction points through their movement. | Try the start, middle and end of travel with a nearby person or object where applicable. |
| Weather and utilities | Reuse the shared daylight, weather, shelter, water and district power behavior. Make a fixture's state readable in its scene. | Check exposure and shelter or the applicable off/on transition. |
| Detail and performance | Fit the silhouette and interaction geometry first. Reuse meshes and materials, use an appropriate level of detail, and keep source files separate from streamed exports. | Check the approach from beyond the stream radius, a close view, and the relevant graphics levels. |

Photo comparisons are indexed by district and include the camera and time used in review. They document both the target and where the city differs. [Photo comparison index](../Meshy%20Sources/City%20reference%20index.md) · [Blender object library](../Blender%20Sources/README.md)

## Game UI

The game HUD styles specify Anton for display text and Inter for interface text, with system fallbacks. It uses dark translucent surfaces over the world, amber for selection and attention, and `--cash` (`#7dff9a`) for cash. Preserve the established meaning of map icons, cash, and warnings. The contribution site has a separate palette and type scale.

| Surface | Existing owner | Pattern to reuse |
| --- | --- | --- |
| Title screen, HUD and touch controls | [index.html](../commonstreet/index.html), [main.js](../commonstreet/js/main.js) | The world stays visible during play. Prompts name the current action and use the existing action button where it fits. |
| Map and travel | [city-map.css](../commonstreet/city-map.css), [city-map.js](../commonstreet/js/city-map.js) | North-up map, named landmark buttons, legend, destination confirmation, time slider and weather state. |
| Resident directory | [residents.css](../commonstreet/residents.css), [resident-directory.js](../commonstreet/js/resident-directory.js) | Search and selected profile with clearly labeled ways to meet someone or inspect their movement. |
| Police desk and case views | [police.css](../commonstreet/police.css), [police-desk.js](../commonstreet/js/police-desk.js) | Named views, clear active selection, and records with status and provenance. |

Use native controls and dialogs where the existing surface uses them. Provide keyboard focus, readable text over bright and dark scenes, and a name or state for icon-only actions. Keep movement input from leaking into menus or dialogs. Test relevant touch controls, keyboard interactions, and dismissal with focus returning to where the player opened the panel. Respect the existing sound and reduced-motion behavior.

## Contribution site

The site uses [city.css](../commonstreet/city/city.css) as its style owner. Barlow Condensed gives headings and buttons their profile, and Inter handles body text, with fallback fonts available. Tokens include `--ink` (`#101213`), `--surface` (`#1b1d1e`), `--paper` (`#f6f4f0`), `--muted` (`#b5b7b6`), `--line` (`#464a4b`), and `--amber` (`#ffbf46`).

Use actual scenes and clips to show what contributors can build. Keep the copy prompt, play link, rules, and release links clear. Make the prompt readable when clipboard access fails and clips usable with the site's sound and playback controls. Verify narrow and wide layouts and keyboard navigation when changing the site.

## Review a visible change

Record the landmark or coordinates, camera, graphics setting, weather and time where they affect the comparison. Capture the ordinary player view and the angle that best proves the change. For an object, include enough of the surrounding street or room to judge scale and clearance. Preserve source credit and the path to the matching runtime export. [Verification guide](development.md#verify-the-change)
