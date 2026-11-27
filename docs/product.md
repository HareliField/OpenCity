# Product direction

Commonstreet is an original 3D coastal city game that grows through contributions. Players explore it in the browser. Contributors can add a room, improve an object, give a resident a new routine, or build an adventure that fits the city. Many small changes should add up to a place people recognize when they return.

## What players do

- **Explore freely.** Walk, drive, choose a destination on the map, and see the same place under different weather and light. Familiar routes should reward looking closely.
- **Use a city full of objects.** Doors, vehicles, taps, tills, lifts, and loose objects have physical behavior. Where the city supports it, common actions carry over between places so people can learn by trying them.
- **Meet people with their own lives.** Named residents have homes, work, relationships, and reasons to be somewhere. The directory and written episodes give contributors a shared cast to build on.
- **Follow small and large threads.** A shop visit, a resident's routine, and a police case are different ways into the same world. Everyday activities and nonviolent stories belong alongside dramatic incidents.

## What exists and where to grow

| Area | In the current game | Direction for contributions |
| --- | --- | --- |
| City | A 16 × 16 coastal street grid, signed roads, graded routes, a waterfront, harbor and freight terminal. | Make existing blocks, rooms and routes richer. Connect improvements to nearby residents, services and traffic. |
| People | A named cast and written city stories, fitted appearances, contact, selected routines, and police watches. | Give more residents coherent days, choices and follow-through without duplicating identities or commitments. |
| Objects and services | Walkable buildings, moving doors and lifts, physics props, shops and selected water, power, and sanitary services. | Make objects useful and consistent across their look, placement, collision, access, and changing conditions. |
| Adventures | Open exploration, everyday interactions, and playable police-case examples. | Add outcomes and alternate paths that fit the shared city. Reuse existing mechanics where they cover the experience. |
| Collaboration | A contributor site, local game preview, a copy-ready agent prompt, and GitHub PR workflow. | Make it easy to propose a small change, try it, explain it, and get feedback before it becomes part of the city. |

The scope is a grounded fictional coastal city. The current play session runs in one browser tab. “Shared city” means contributors build the same project. Multiplayer, a universal schedule for every resident, and a persistent citywide economy are outside current implemented behavior.

## How we choose what to build

1. **Start with a person, place, or object players can find.** Describe the change in terms of a visit someone else can reproduce.
2. **Make the ordinary day believable.** Establish what the thing is for, who uses it, and how it fits the block. Then try a condition that changes the answer, such as rain, closing time, an outage, or a blocked route.
3. **Carry consequences through supported systems.** A trade should update the parts the game represents. An incident should depend on what the game actually observed. An adventure should handle leaving and returning.
4. **Make one finished addition useful to the next contributor.** Preserve stable names, identities, and shared routes. Leave instructions for finding the change and record any design lesson worth reusing.

## Adventure brief

Describe the location, the participating residents, and what starts it. Give the player something they can discover or do, with a success condition they can observe. Explain what happens if they leave, return late, miss a step, or try again. Say what carries forward, what can be repeated, and what happens to the people or place afterward. Flag new mechanics and citywide effects for maintainer review.

For example, a proposed Saturday stall could open for a named seller at a particular square, offer a choice of goods through an existing purchase flow, and close when the seller packs the stock. The square should still make sense on weekdays and the stall should leave the travel path clear. [City design guide](../CONTRIBUTING.md) · [City rulebook](collaboration.md#city-rulebook)
