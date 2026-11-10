[![CI](https://github.com/pandaGaume/3d-tiles-babylon/actions/workflows/ci.yml/badge.svg)](https://github.com/pandaGaume/3d-tiles-babylon/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

<img src="https://raw.githubusercontent.com/pandaGaume/3d-tiles-core/main/assets/brand/spacexr-component.png" alt="SpaceXR Component" height="56">

# 3D Tiles for Babylon.js

`3d-tiles-babylon` is the Babylon.js adaptation of [3d-tiles-core](https://github.com/pandaGaume/3d-tiles-core), the renderer-neutral OGC 3D Tiles runtime of SpaceXR.

The runtime owns traversal, level of detail, loading and caching. This repository binds it to Babylon.js 9: camera frames, render loop, glTF content, attributions, monitoring, imagery draping on terrain and terrain engines interchangeable behind `ITerrainEngine`.

## Repository layout

```text
packages/core/                         @spacexr/3d-tiles-babylon
examples/babylon-google-3d-tiles/      Google Photorealistic 3D Tiles
examples/babylon-implicit-grid-mapzen/ Implicit WebMercator quadtree with Mapzen elevation
docs/                                  Terrain settings and how to set them
```

Every terrain setting, its default and the URL parameter that overrides it are listed in [Terrain settings](docs/terrain-settings.md).

## Usage

```ts
import "@babylonjs/loaders/glTF/2.0/index.js";
import {
  BabylonGltfTileAdapter,
  BabylonRuntimeDriver,
  createGeospatialCamera,
  createGeospatialEngine,
  createGeospatialScene,
} from "@spacexr/3d-tiles-babylon";
import { TilesetJsonCodec } from "@spacexr/3d-tiles-core";
import {
  EcefSpatialMetric,
  TileRuntime,
  type ITilesetLoader,
} from "@spacexr/3d-tiles-runtime";

const engine = createGeospatialEngine(canvas);
const scene = createGeospatialScene(engine);
const camera = createGeospatialCamera(scene, {
  target: { latitudeDegrees: 48.8566, longitudeDegrees: 2.3522 },
  radius: 1800,
});

const codec = new TilesetJsonCodec();
const tilesets: ITilesetLoader = {
  load: async ({ uri, signal }) => ({
    tileset: codec.decode(await (await fetch(uri, { signal })).text()),
  }),
};
const content = new BabylonGltfTileAdapter(scene);
const runtime = new TileRuntime({
  id: "city",
  uri: "https://example.test/tileset.json",
  adapter: {
    tilesets,
    activation: content,
    presentation: content,
    spatial: new EcefSpatialMetric(),
  },
});

await new BabylonRuntimeDriver(runtime, scene, { camera }).start();
engine.runRenderLoop(() => scene.render());
```

See the [package README](packages/core/README.md) for the complete API, including imagery draping and the terrain engines.

## Development

`@spacexr/3d-tiles-core`, `@spacexr/3d-tiles-runtime`, `@spacexr/tiles`, `@spacexr/raster`, `@spacexr/dem` and `@spacexr/grid` are not published yet. Until they are, this workspace links them from a `3d-tiles-core` checkout next to this repository, which must be built first:

```text
Gaume/
├── 3d-tiles-core/
└── 3d-tiles-babylon/
```

```bash
cd ../3d-tiles-core/node
npm ci
npm run build
cd ../../3d-tiles-babylon
npm ci
npm run check
```

The links are declared as `file:` dependencies of the root `package.json`. Once 3d-tiles-core is published, removing them is enough: the packages already depend on version `0.1.0`.

The CI builds against `main` of 3d-tiles-core, or against its branch with the name of the pull request branch when there is one. A change spanning both repositories uses one branch name, so its pull request here passes before core merges. Merge core first: `main` here builds against `main` of core. Delete the branch in core once merged, or a later branch with that name would build against it.

Run an example:

```bash
npm run example:implicit-grid
```

```bash
npm run example:google-3d-tiles
```

The Google example needs a Map Tiles API key; see its [README](examples/babylon-google-3d-tiles/README.md).

### Shaders

Shaders live in their own `.glsl` files, in a `shaders` folder beside the code that uses them, and their WGSL twins for WebGPU in `.wgsl` files of a `shaders/wgsl` folder. Edit those files, never the `.ts` module generated beside each one, then generate the modules:

```bash
npm run shaders
```

While an example runs, `npm run shaders:watch` regenerates them on every change, and the example reloads. `npm run check` fails when a module is out of date. See [packages/tools](packages/tools/README.md). VS Code recommends a GLSL extension for this repository.

## License

Apache-2.0. See [LICENSE](LICENSE).
