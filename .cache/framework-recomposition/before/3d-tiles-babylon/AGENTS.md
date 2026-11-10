# AGENTS.md, 3d-tiles-babylon

Read this file before modifying the repository.

## Repository boundaries

- `packages/core/` contains `@spacexr/3d-tiles-babylon`, the Babylon.js adaptation of the renderer-neutral runtime.
- `packages/tools/` contains the private build tools of this repository, such as the shader compiler.
- `examples/` contains Babylon.js applications built on that package.
- The 3D Tiles wire model, codecs, validation and runtime live in [3d-tiles-core](https://github.com/pandaGaume/3d-tiles-core). Do not copy or fork them here.

## Current scope

The package contains what every Babylon.js integration of the runtime needs:

1. ECEF camera frames, camera change detection and the geospatial camera;
2. the render loop driver of the runtime;
3. glTF 2.0 tile content and external tilesets through the split activation and presentation ports;
4. copyright attributions and runtime monitoring.

Application-specific code stays in the examples: data provider authentication, proxies, terrain grids, DEM elevation and user interface.

All TypeScript interfaces use an uppercase `I` prefix, for example `IBabylonGltfTileHandle`.

## Rules

- Never infer content type only from a file extension. Recognize payloads from their bytes.
- Never register Babylon loaders as a side effect of the package. Applications import `@babylonjs/loaders` themselves.
- Keep tile keys ephemeral. They are not stable feature or business identifiers.
- The scene uses ECEF metres, the right-handed system and large world rendering.
- Write shaders in their own files under a `shaders` folder, never as strings in TypeScript. Never edit the generated `.ts` module beside a shader: run `npm run shaders`. See [packages/tools](packages/tools/README.md).

## Commands

`3d-tiles-core` must be checked out next to this repository and built, because its packages are linked until they are published:

```bash
cd ../3d-tiles-core/node
npm ci
npm run build
cd ../../3d-tiles-babylon
npm ci
npm run check
```

`check` runs formatting, lint, type checking, tests and the production build.
