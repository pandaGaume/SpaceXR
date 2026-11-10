<img src="https://raw.githubusercontent.com/pandaGaume/3d-tiles-core/main/assets/brand/spacexr-component.png" alt="SpaceXR Component" height="56">

# Babylon implicit grid, Mapzen

This example is the integration proof for the renderer-neutral runtime pipeline.

The 3D Tiles runtime owns camera traversal, implicit tiling, LOD selection, readiness, metadata handles and cache policy. The terrain engine only implements `ITileActivationAdapter` and `ITilePresentationAdapter`. It never imports `TileRuntime` internals.

The terrain engines, the grid pipeline and the geodesic grid source come from `@spacexr/3d-tiles-babylon`. The example only assembles them: it creates the terrain and imagery runtimes, the DEM pyramid and the imagery pages, and hands presented tiles to an engine behind `ITerrainEngine`, selected with `engine`. `mesh`, the default, shares one normalized grid topology and creates one geometry per tile on the CPU: every ready tile receives unique ECEF vertices projected from its geographic region onto the WGS84 ellipsoid, so curvature and east-west pinching follow both LOD and latitude. `gpu` instances one predefined grid instead, refined on its edges as in SpaceXR, once per tile of the finer of the terrain and imagery cuts, displaced in the vertex shader from elevation pages; it renders the terrain in one draw call, without cracks and without skirts. Debug labels are shown by the mesh engine only.

Every presented tile is colored by absolute LOD and receives a screen-space `X/Y/LOD` label. Those identifiers are also published through the example's 3D Tiles metadata, making parent-child overlap and incorrect replacement cuts directly visible while debugging traversal.

The scene root covers the complete WebMercator domain and contains 64 independent sources, one for every `X/Y` address at LOD 3. Each `WebMapTileDataSource` owns the shared `WebMercatorTileMetrics` configuration with `minLOD = 3` and `maxLOD = 18`, its root address and its `grid://` URL template. Its `ImplicitTilesetDecorator` derives sixteen available levels and cannot request an address beyond LOD 18.

The explicit scene root has no renderable content. It lets the standard runtime select only the visible LOD 3 source roots. A routing resolver then delegates every implicit tile to the decorator that owns its root. The coverage is global within the WebMercator latitude limits of approximately 85.051 degrees north and south.

Run it from the repository root, after building 3d-tiles-core as described in the [repository README](../../README.md):

```bash
npm run example:implicit-grid
```

No API key or `.env` file is required.

## Elevation

Grid vertices are displaced with Mapzen Terrarium heights from a `DemPyramid` of `@spacexr/dem`, one DEM tile per grid tile. Below level 15, the deepest Terrarium level, DEM tiles are generated level by level down to 18, the deepest grid level, by interpolating the level above: `interpolation=cubic` (default), `bilinear`, `linear` or `nearest`.

DEM tiles are stitched with the first column, row and sample of their east, south and south-east neighbours, as in SpaceXR, and sampled in point registration: neighbouring grids of the same level read identical heights on their shared edge. Where tiles of several levels meet, every edge vertex takes the height chosen by the `heights` parameter, computed identically by every tile touching it. The runtime keeps neighbouring tiles within one level of detail (2:1 quadtree balance), and shaded rendering uses normals of the stitched DEM surface, so tile edges show neither cracks nor shading seams.

When many tiles arrive at once, the grids whose neighbours changed are rebuilt within `junctionBudget` milliseconds per frame, cracks first and nearest first, so that a wave of loaded tiles spreads over several frames instead of stalling one.

Tiles start with a 0/0 m height range. When a DEM is loaded, the tile reports its measured range to the runtime through `tileBoundingVolume`, and the four quadrant ranges are recorded for its children. The resolver applies them when the children are created, and the runtime applies them again to children created before the parent DEM arrived.

The settings of the terrain are in `packages/core/src/terrain/terrain-config.json`, and URL parameters override them for one page. The camera starts above the Mont Blanc summit, or at the place `place`, `lat` and `lon` give. [Terrain settings](../../docs/terrain-settings.md) lists every setting and every URL parameter, with its default and its effect.

The Mapzen attribution is displayed in the bottom-right corner.

## Runtime monitoring

The overlay joins the renderer-neutral runtime cache statistics with Babylon counters. It reports selected and cached tiles, tracked CPU/GPU/subtree memory, JavaScript heap usage when the browser exposes it, cumulative content and subtree evictions, implicit branch pruning, FPS, draw calls and the number of Babylon meshes created, shown and released.

The `Frame` line uses Babylon's standard `SceneInstrumentation` and `EngineInstrumentation` counters, averaged over the last second: frame time, time between frames (JavaScript outside rendering, such as runtime traversal and tile reception), render time, active mesh selection time and GPU frame time when the browser exposes GPU timer queries. DEM tiles are decoded in a pool of web workers, so their decoding does not appear in these timings.

Monitoring is throttled to four publications per second. Open the example with `?monitor=0` to disable both runtime metric collection and Babylon `SceneInstrumentation` observers when measuring the viewer without diagnostic overhead.

## Imagery

Shaded grids (`solid=1`) are draped with imagery from a second implicit quadtree, levels 3 to 20, traversed by its own runtime on texel size rather than geometric error. Each terrain tile is divided into as many cells as the imagery cut needs above it, one page per cell, up to 4 levels below the terrain: distant tiles show one page, near tiles up to 256, and a cell falls back to a coarser page while its own loads; pages are stitched with their neighbours, so the imagery shows no seam between pages. `kmax` sets the deepest drape, 4 levels below the terrain by default.

`imagery=debug`, the default, draws the pages locally: a checkerboard tinted by level and labelled with the page address, which makes the binding visible. `imagery=none` keeps the level colours.

`imagery=<name>` drapes the imagery of `src/local/<name>.imagery.ts`, a module exporting `createImagery()` with a tile loader, a maximum level and an attribution (see `src/local-imagery.ts`). The `src/local/` folder is ignored by git, for sources that must stay on the developer machine.

## Mercator selection and independent resolutions

Mercator uses `selectionStrategy: "base"` and `geometrySelection: "runtime"` for both `engine=mesh` and `engine=gpu`. The same runtime publishes the geometric tiles. CPU junctions complete before drawing. The GPU groups exact fine-side `Coarser` topologies and does not subdivide the terrain when imagery changes. Its Mercator surface positions are calculated analytically, with no texture of XYZ positions. The current functional GPU step uses up to 16 whole topology variants; the planned interior and edge-patch optimization remains a separate step.

The render loop updates the camera, awaits the ready runtime selection, then draws that camera without applying its inputs twice. Loads and preparation remain asynchronous. Mercator uses a fixed SSE threshold with the configured hysteresis and coarsening delay.

Geometry, source DEM levels, generated DEM levels and imagery pages have distinct identities. A geometric tile can be finer than its measured DEM. Generated heights follow `interpolation`. `demGeneratedLevels` sets their depth below the physical DEM limit, independently of the geometric limit (default 3, range 0 to 8). At zero, finer geometry samples a sub-area of its measured ancestor. No source request is sent for an absent generated level.

`imagerySubdivision=2`, `4` or `8` sets the maximum correspondence between physical DEM and imagery: one DEM tile covers respectively 4, 16 or 64 imagery tiles under the shared addressing. The default is `TERRAIN_CONFIG.imagery.demSubdivision`. This advances the imagery limit by 1, 2 or 3 levels beyond the physical DEM source limit, never beyond the imagery source limit. Generated DEM levels do not advance it. The imagery runtime still requests only the pages its view needs, and a missing fine page falls back to a resident ancestor. Imagery updates do not change geometric tile addresses or junctions.

For comparable checks, use the same backend-independent settings and camera path with `?engine=mesh&solid=1&imagery=debug&imagerySubdivision=4` and `?engine=gpu&solid=1&imagery=debug&imagerySubdivision=4`. Use `monitor=0` when measuring without the diagnostic overlay.

For satellite comparisons, `lighting=ambient` uses uniform white ambient without directional or hemispheric shading. This is an explicit diagnostic mode. The default, `lighting=terrain`, retains the directional sun and hemispheric light. The GPU ambient variant omits the normal varyings and DEM-gradient calculations; geometry, height samples, topology and imagery pages stay the same.

On Mercator GPU with Mapzen elevations and terrain lighting, `normals=mapzen` is the default: separate Mapzen normal tiles provide the shading directions. Their physical limit stays L15; finer geometry samples the corresponding sub-area. The alpha channel encodes hypsometric height classes and is ignored. A byte-preserving PNG data decoder keeps RGB intact regardless of alpha. `normals=dem` selects the previous DEM-gradient calculation for comparison, and it also supplies the temporary fallback while a normal page loads. Neither mode changes geometry or imagery. The mesh engine keeps its own normals.

`normalMaxLOD` independently caps the provider-normal pyramid (default 15, range 0 to 15). For example, `normalMaxLOD=12` compares the original normal tiles at a coarser source resolution while leaving the geometry, height data, imagery and directional light unchanged. This diagnostic does not modify or smooth the loaded normal pixels.
