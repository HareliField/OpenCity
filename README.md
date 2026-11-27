# Commonstreet

Commonstreet is an original browser-based 3D game and a shared city anyone can help build. Walk from a neighborhood laundromat to the waterfront, drive across the viaduct in changing weather, or follow a resident's story across town. Contributors grow the same city by adding places, people, objects, and playable adventures or improving the ones already there.

[Watch the project launch film](commonstreet/films/commonstreet-launch-trailer.mp4) · [Film credits](commonstreet/films/commonstreet-launch-credits.md)

## Play locally

From a checkout of the repository, run:

```sh
python3 commonstreet/tools/serve.py
```

Open [the game](http://127.0.0.1:8765/index.html) in a WebGL-capable browser and press **Play**. Use the arrow keys or the touch stick to move, **C** or **Action** to interact, and the round radar to open the city map. The game starts with sound off. Python serves the checked-in game and assets. There is no build step. [Controls and player manual](commonstreet/README.md#play-locally)

The [local city website](http://127.0.0.1:8765/city/) shows contribution examples and provides a copy-ready coding-agent prompt. Codex agents follow the [muted preview instructions](AGENTS.md#launching-and-inspecting-the-game).

## Help build the city

Start with a model, a place, or an issue someone else can reproduce. Use the [contributor prompt](commonstreet/city/contribute.txt) to build and preview a change, then share it in a GitHub PR.

| I want to… | Start here |
| --- | --- |
| Explore the city and understand the rules of play | [Player rules](docs/play-rules.md) · [World map](docs/world-map.md) |
| Understand what the project is building | [Product direction](docs/product.md) |
| Add a reusable 3D model | [Model library](commonstreet/models/scenery/library/README.md) · [Local model preview](http://127.0.0.1:8765/model-preview.html) |
| Decorate a place using an existing model | [Placement files](commonstreet/world/decorations/README.md) |
| Contribute or review a change | [Contribution paths](docs/collaboration.md#choose-a-contribution-path) · [City design guide](CONTRIBUTING.md) |
| Make art, models, or interfaces | [Design system](docs/design-system.md) |
| Work on code, data, or verification | [Architecture and stack](docs/architecture.md) · [Development guide](docs/development.md) |
| Find the owner of any topic | [Documentation index](docs/README.md) · [Agent instructions](AGENTS.md) |

The game is maintained in the [HareliField/OpenCity repository](https://github.com/HareliField/OpenCity). The editable art libraries and included third-party assets carry their own provenance records. [Asset sources and public licensing decisions](docs/decisions.md#public-code-and-asset-terms)
