# Terrain Core

Renderer-neutral rasters, elevation and grids for the existing SpaceXR framework. The terrain is exposed through implicit 3D Tiles and uses the single runtime in `3d-tiles-core`.

| Package | Responsibility |
| --- | --- |
| `@spacexr/raster` | Raster grids, sampling, image decoding, stitching and draping calculations |
| `@spacexr/dem` | Elevation codecs, providers, pyramids, gradients and surfaces |
| `@spacexr/grid` | Reusable grid topology, junctions and CPU geometry |

Package names, version 0.1.0 and public imports are preserved. The packages were extracted from `3d-tiles-core/node/packages` without changing algorithms. Tile addressing, generic pyramids and the single selector remain in `@spacexr/tiles` and `@spacexr/3d-tiles-runtime`.

## Development

Check out `3d-tiles-core`, `terrain-core` and `spacexr-rendering` as siblings. From `spacexr-rendering`, run `npm run framework:install`, then `npm run framework:build` or `npm run framework:check`.

For this repository alone, build `../3d-tiles-core/node`, then run `npm ci` and `npm run check` here. Local links are declared at the root; published package manifests keep their versioned dependencies.

Open `terrain-core.code-workspace` or `../spacexr-rendering/SpaceXR-Framework.code-workspace`. The default build task builds core, terrain and rendering in dependency order.

## Documentation

- [Rasters](docs/raster.md)
- [Elevation](docs/dem.md)
- [Grid topology](docs/grid.md)
- [Draping](docs/draping.md)
- [Migration and consumers](docs/migration.md)
- [Rendering and reference examples](../spacexr-rendering/README.md)

Morphology improvements, oriented cliffs, new MCP behaviors and visual localization are later functional work. This phase preserves the current working framework.
