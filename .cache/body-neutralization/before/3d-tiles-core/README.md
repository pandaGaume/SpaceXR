# 3D Tiles Core

Renderer-neutral contracts and the single SpaceXR 3D Tiles runtime, shared by terrain and 3D content.

| Package | Responsibility |
| --- | --- |
| `@spacexr/3d-tiles-core` | Immutable wire model, JSON codecs, validation and extensions |
| `@spacexr/tiles` | Addresses, cube/Mercator topology, generic pyramids, HTTP sources and reprojection |
| `@spacexr/3d-tiles-runtime` | Traversal, selection, availability, streaming, caches and presentation lifecycle |

The repository keeps `node/`, `conformance/`, cross-language `docs/`, and the reserved `dotnet/` and `cpp/` directories. The runtime never adds mutable state or scene objects to serialized documents. Ellipsoids and coordinate transforms remain in `@spacexr/geodesy`.

## Framework repositories

Raster, DEM and grid packages have moved to [terrain-core](../terrain-core/README.md). The existing Babylon adapter, shader tools, terrain benchmark and both reference examples have moved to [spacexr-rendering](../spacexr-rendering/README.md). Package identities, versions, APIs, tests and algorithms are preserved. All terrain remains compatible with implicit tilesets and uses this runtime.

## Development

```sh
cd node
npm ci
npm run check
```

For integration, open [3d-tiles-core.code-workspace](3d-tiles-core.code-workspace), or [SpaceXR-Framework](../spacexr-rendering/SpaceXR-Framework.code-workspace). The default build task builds core, terrain and rendering in dependency order. From `../spacexr-rendering`, `npm run framework:install`, `npm run framework:build`, `npm run framework:check` and `npm run framework:verify` provide the shared workflow.

## Documentation

- [Runtime architecture](docs/runtime-architecture.md)
- [Generic tiles](docs/tiles.md)
- [Celestial tiling](docs/celestial-tiling.md)
- [Cube sources](docs/cube-sources.md)
- [Terrain package documentation](../terrain-core/README.md)
- [Rendering pipeline and historical measurements](../spacexr-rendering/docs/terrain-pipeline.md)
- [Repository migration and consumers](../spacexr-rendering/docs/framework-migration.md)

The Node release retains its `node-v*` tag series and publishes only the three packages owned here. Moved packages require their new npm publisher configuration before any future release. License: Apache-2.0.
