from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parent))
s=Path(__file__).with_name('neutralize_framework.py').read_text()
exec(s[:s.index('tiles=CORE')],globals())
tiles=CORE/'node/packages/tiles'

put(tiles/'README.md','''# @spacexr/tiles

Renderer-neutral tile addressing, topology, URL templates, HTTP sources and on-demand pyramids. The package has no renderer, body catalogue, cube projection or provider preset.

## Configure a source

The application supplies its `GeodeticSystem`, normally constructed from the ellipsoid selected in `spacexr-celestial`. No reference body is selected implicitly.

```ts
import type { GeodeticSystem } from "@spacexr/geodesy";
import { WebMercatorTileMetrics, WebTileSource } from "@spacexr/tiles";

export function createSource(system: GeodeticSystem, urlTemplate: string) {
    return new WebTileSource({
        id: "application-source",
        urlTemplate,
        metrics: new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 18 }, system),
        registration: "area",
    });
}
```

Tile addresses, parents/children, flat neighbours, residency and ancestor areas stay independent of content. An optional root identifier isolates independent pyramids; it does not install a particular projection. `ReferenceSurface`, direction conversions and edge rotations are generic mathematical helpers under the `surface` and `addressing` entries.

Web Mercator and source projections require explicit radii or geodetic systems. Raster registration is always declared: `area` describes pixel areas; `point` describes shared-edge samples. The single 3D Tiles runtime composes these primitives with its own wire model.

The former `./cube` export and cube reprojection were removed from the active package. Source-specific WMTS captures and body datasets are outside this framework delivery. See [the framework architecture](../../../../spacexr-rendering/docs/architecture.md).
''')
put(TERRAIN/'packages/dem/README.md','''# @spacexr/dem

Generic elevation data on `@spacexr/raster`: numeric codecs, worker decoding, statistics, normals, loading and continuous pyramid surfaces. There is no body catalogue, cube adapter or network provider preset.

`IDemTileSource` combines a configured `WebTileSource` with its `DemEncoding`. Supply it to `webDemTileLoader` or `loadDemTile`. Build `DemPyramid` with explicit source levels, raster registration, loader and cache options. Terrarium, Terrain-RGB and normal-image decoders describe data formats; their support does not select a body or service.

The application supplies the physical surface. `webMercatorSurfaceNormal` requires its radius explicitly. The data source resolution and the spatial refinement level remain distinct. Heights beyond the available data use their ancestor area according to the configured pyramid policy.

Mapzen URLs and source factories now belong to `spacexr-rendering/examples/babylon-implicit-grid-mapzen/src/providers`. Their tests run with the sample. Generic DEM tests use a local synthetic provider. The removed cube factories are not part of the public API.

See [elevation contracts](../../docs/dem.md) and [physical ownership](../../../spacexr-rendering/docs/architecture.md).
''')
put(TERRAIN/'docs/dem.md','''# Elevation contracts

A DEM is a numeric height grid with explicit units, registration and missing values. Its source supplies addressing, levels, encoding and availability. Physical surface characteristics come from the application, normally using the Celestial model.

`DemPyramid` samples its configured raster hierarchy and tracks source/ancestor regions. `ChildHeightRanges` records measured ranges. `webDemTileLoader` and `loadDemTile` use the generic `IDemTileSource`. Source URLs, provider limits and attribution are application configuration.

Heights, gradients, normal reconstruction and spatial bounds use the same declared surface and units. The source level does not imply that the runtime must stop spatial subdivision. This delivery retains the existing interpolation behavior; morphological refinements remain separate work.

Cube datasets, radial cube loaders and body-specific producers have been removed. The reusable surface mathematics remains parameterized. See [raster contracts](raster.md), [grid geometry](grid.md) and [framework layers](../../spacexr-rendering/docs/architecture.md).
''')
put(TERRAIN/'docs/raster.md','''# Raster contracts

Rasters store interleaved channels in row-major order. Width, height, channel count and raster registration are explicit. Floating-point missing values are NaN. Numeric image decoders preserve stored values without colour-space conversion or alpha premultiplication.

With `area` registration, pixels represent areas; stitching obtains shared sampling boundaries from neighbours. With `point` registration, samples include shared edges. Tile pyramids provide loading, retention, ancestor subregions and cache lifecycle independently of any body or renderer.

Interpolation and neighbour access are generic data operations. Independent roots remain isolated. Topology ports describe their connectivity without requiring a particular projection. Provider endpoints and physical-body descriptors belong to the application or sample.
''')
put(TERRAIN/'docs/grid.md','''# Grid geometry

The grid package produces reusable normalized topologies and junction variants for neighbouring levels of detail. It does not select tiles, load a body catalogue or create renderer objects.

`buildGridTileGeometry` receives a topology, tile address and explicit `ITileSurface`. Positions are relative to a double-precision tile centre; up vectors state the displacement direction. `buildGridTileShape` produces reusable local shapes from the same supplied surface.

The single runtime selects the geometry cut. Rendering engines use this topology and the configured DEM. Junction and boundary calculations use the declared neighbour topology. The current generic framework contains no cube implementation or body-specific grid factory.
''')
put(TERRAIN/'docs/draping.md','''# Raster draping

Terrain and imagery can have different resolutions while sharing the same 3D Tiles runtime implementation. An application may configure separate instances for their selections. Raster residency and page mappings bind the available imagery to the terrain geometry cut.

CPU mesh and GPU instancing presentations reuse generic addresses, ancestor areas, topology and source registration. Their data and cache ownership remain explicit. A provider, body or projection is not inferred from an image or tile identifier.

The reference demonstration supplies an Earth fixture and Mapzen data explicitly. That configuration is outside the public raster and terrain packages. See [framework architecture](../../spacexr-rendering/docs/architecture.md).
''')
put(CORE/'docs/tiles.md','''# Generic tiles

`@spacexr/tiles` owns content-neutral addresses, neighbour topology, residency, pyramids, HTTP sources and source projections. A tile has a level and coordinates; an optional root identifier separates independent pyramids.

The application supplies a geodetic system or surface descriptor. `WebMercatorTileMetrics` and `WebMercatorTileSurface` require that system. Source projections and tile matrices require physical radii explicitly. No body catalogue or default Earth is embedded in these components.

The 3D Tiles runtime decorates configured sources as implicit tilesets and owns selection and streaming. Standard 3D Tiles wire semantics and CRS identifiers stay in the contracts; application datum transformations and vertical envelopes are explicit policies.

The active framework excludes cube implementations and body-specific source tools. See [terrain data](../../terrain-core/README.md) and [framework architecture](../../spacexr-rendering/docs/architecture.md).
''')

f=RENDER/'packages/core/README.md';t=f.read_text()
t=t.replace('The scene works in WGS84 ECEF metres','The scene works in the supplied ECEF reference system, in metres')
t=t.replace('Defaults to WGS84','Requires an explicit geodetic system')
t+='\n## Explicit physical configuration\n\n`createGeospatialCamera` and `EcefSpatialMetric` require a geodetic system. Terrain engines and pipelines require an explicit tiling. `createGeodesicGridSource` requires source metrics. There is no exported `TILE_METRICS` default. Provider presets are sample configuration. See [the layer architecture](../../docs/architecture.md) and [the adapted standalone examples](../../examples/).\n'
put(f,t)
for f in [CORE/'README.md',TERRAIN/'README.md',RENDER/'README.md']:
    t=f.read_text()
    t=t.replace('Google content still requires its existing provider credentials; lunar and Martian datasets require the existing tile service.','Google content still requires its existing demonstration credentials.')
    t=t.replace('Cube rendering and the experimental cube branches are explicitly deferred. Existing generic cube data/addressing APIs and their tests are preserved, without extending the renderer. Explorer\'s cube integration is not part of this delivery.','Cube modules and lunar tools have been removed from the active framework. Body data and provider configuration belong to samples or optional body-specific compositions.')
    t=t.replace('Package names, version 0.1.0 and public imports are preserved.','Package identities and current local version 0.1.0 are preserved. Physical configuration is now explicit; cube APIs and provider preset exports have been removed.')
    put(f,t)
for f in [RENDER/'docs/framework-migration.md',TERRAIN/'docs/migration.md']:
    put(f,'''# Framework migration

The canonical package owners are `3d-tiles-core` (wire model, tiles and runtime), `terrain-core` (raster, DEM and grid), and `spacexr-rendering` (Babylon integration, tools and samples). Their relative sibling links and lockfiles provide the local development framework.

The subsequent cleanup removes cube APIs, datasets and sample lunar tooling from the active framework. Physical parameters are explicit: configure `GeodeticSystem`, source metrics and terrain tiling. Datum transformations and unknown-height envelopes also require caller policy. Former `TILE_METRICS` and Mapzen provider exports are no longer library defaults; the Earth sample supplies its own configuration.

The optional future `@spacexr/babylon-earth` composition belongs in `spacexr-rendering/packages/babylon-earth`. It will combine Celestial physical descriptors, the existing tile runtime, terrain, camera and atmosphere integration. Generic packages remain independent of any body catalogue.

Open `SpaceXR-Framework.code-workspace` for library development; the applications workspace now includes only the reference demonstrations. Body-specific Explorer and tile-service integrations remain separate projects for later work. The legacy Babylon root commands still forward to rendering.

Retired source directories and initial files remain in local ignored migration backups, outside active package exports. No commit, repository push or npm publication has been performed. These local API changes need coordinated versioning before any eventual release.
''')
f=RENDER/'docs/consume-framework.md';t=f.read_text()
t+='\n## Updated configuration contract\n\nObtain an ellipsoid from `spacexr-celestial` in your application composition, construct its `GeodeticSystem`, and pass it to camera, metrics and spatial metric factories. Pass the corresponding `webMercatorTiling(system)` to terrain engines. Supply metrics explicitly to `createGeodesicGridSource`. Mapzen factories are demo code, not generic package exports. The future `@spacexr/babylon-earth` facade will encapsulate this Earth-specific assembly with atmosphere; it is currently an architectural target.\n'
put(f,t)
print('Updated the public guides for explicit configuration and the planned Earth composition.')
