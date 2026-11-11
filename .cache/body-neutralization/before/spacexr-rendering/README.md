# SpaceXR Rendering

The working Babylon 3D Tiles and terrain framework, recomposed into its new repository while preserving package names and algorithms.

| Repository | Packages |
| --- | --- |
| `3d-tiles-core` | `@spacexr/3d-tiles-core`, `@spacexr/tiles`, `@spacexr/3d-tiles-runtime` |
| `terrain-core` | `@spacexr/raster`, `@spacexr/dem`, `@spacexr/grid` |
| `spacexr-rendering` | `@spacexr/3d-tiles-babylon`, private shader/benchmark tools and both examples |

## Start developing

All three repositories must be siblings. Node.js 22 is recommended for the existing browser benchmark tools; packages retain their current minimum engines.

```sh
npm run framework:install
npm run framework:build
npm run framework:verify
npm run example:implicit-grid
```

`npm run framework:check` runs the existing formatting, lint, type checks, tests and builds in dependency order, including both reference examples. Google content still requires its existing provider credentials; lunar and Martian datasets require the existing tile service.

Open [SpaceXR-Framework.code-workspace](SpaceXR-Framework.code-workspace) for library work, or [SpaceXR-Applications.code-workspace](SpaceXR-Applications.code-workspace) to include Explorer, Celestial, Quantia and the tile service. Task folder names are stable and paths are relative.

The Babylon adapter remains together in `packages/core` for this first phase. Splitting terrain, atmosphere, generic kernels, Three integration or MCP packages is deferred until the working framework has been qualified. See [migration](docs/framework-migration.md), [terrain pipeline](docs/terrain-pipeline.md), [terrain settings](docs/terrain-settings.md) and [renderer evaluation](docs/renderer-evaluation.md).

## First delivery scope

The validated reference is the current 3D Tiles and Web Mercator terrain framework. Cube rendering and the experimental cube branches are explicitly deferred. Existing generic cube data/addressing APIs and their tests are preserved, without extending the renderer. Explorer's cube integration is not part of this delivery.

Read [validation and known consumer limitations](docs/validation.md). The full adapter API and its usage examples remain in [the package guide](packages/core/README.md).

For another development project, use [the local consumer guide](docs/consume-framework.md).
