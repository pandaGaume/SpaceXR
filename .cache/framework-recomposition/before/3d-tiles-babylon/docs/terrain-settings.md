# Terrain settings

Every setting of the terrain, where it lives and how to change it. The example used throughout is `examples/babylon-implicit-grid-mapzen`.

## Three ways to set a value

| Where                                                                                 | Scope                                            | When to use it                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| [`terrain-config.json`](../packages/core/src/terrain/terrain-config.json)             | Every page that uses `@spacexr/3d-tiles-babylon` | A lasting change of a setting                         |
| A URL parameter of the example, for example `?sse=16`                                 | One page load                                    | Trying a value, or a measurement with the bench       |
| An option of an engine in code, for example `new GpuTerrainEngine(inputs, { cells })` | The engine built with it                         | An integration that needs another value than the file |

Settings belong in `terrain-config.json`, not in the code. Its type, `ITerrainConfig` in [`terrain-config.ts`](../packages/core/src/terrain/terrain-config.ts), documents each field and is exported with the values as `TERRAIN_CONFIG`.

**Change the file:** edit `packages/core/src/terrain/terrain-config.json`, then reload the page. The example imports the sources of `packages/core` through a Vite alias, so the dev server serves the new value without a build. A published build of the package needs `npm run build` again.

**Override in the URL:** a parameter wins over the file for that page only. Open, for example:

```text
http://localhost:5174/?engine=gpu&radius=25000&pitch=60&sse=16
```

A parameter that is missing takes the value of the file. A parameter that takes a list of values, such as `interpolation`, or a range, such as `demGeneratedLevels`, stops the page with an error naming it when the value is not allowed. Numbers such as `sse` are not checked.

## How much the terrain refines

These settings decide how fine the terrain is drawn. To refine less, raise `screenSpaceError`.

| Setting                                 | Value | URL             | Effect                                                                                                                                                                  |
| --------------------------------------- | ----- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selection.screenSpaceError`            | 10    | `sse`           | Screen-space error, in pixels, above which a terrain tile refines. The geometric error of a tile is the ground size of its cells, so a higher value draws coarser tiles |
| `selection.hysteresis`                  | 0.2   | `hysteresis`    | A refined tile coarsens again only once its error drops below `1 - hysteresis` times the threshold: 8 pixels at 10. Also used by the imagery runtime                    |
| `selection.coarseningDelayMilliseconds` | 300   | `coarsenDelay`  | Time a refined tile waits before it coarsens. Also used by the imagery runtime                                                                                          |
| `selection.frustumMargin`               | 0.25  | `frustumMargin` | Periphery of the view, as a fraction of its half extent. Its terrain tiles load down to the threshold without being drawn, after every load of the view. 0 turns it off |
| `grid.cells`                            | 64    |                 | Cells per side of a terrain grid. It sets the geometric error of a tile, so it changes the level the threshold reaches. Grids of 16 cells are ruled out                 |
| `mercator.minLOD`, `mercator.maxLOD`    | 3, 18 |                 | Levels of the Web Mercator terrain quadtree                                                                                                                             |
| `imagery.screenSpaceError`              | 2     |                 | Threshold of the imagery runtime, in texels per screen pixel: the geometric error of an imagery tile is one texel                                                       |

`motion` (`maxScale`, `restPixelsPerSecond`, `fullPixelsPerSecond`, `releaseMilliseconds`) is not read by the Mercator example: the threshold does not follow the speed of the camera.

## Loading and memory

| Setting                         | Value | URL             | Effect                                                                                      |
| ------------------------------- | ----- | --------------- | ------------------------------------------------------------------------------------------- |
| `selection.maxConcurrentLoads`  | 12    |                 | Loads that run at once, per runtime: terrain and imagery each have their own 12             |
| `selection.contentCacheEntries` | 1024  |                 | Terrain tiles kept in the cache of the terrain runtime                                      |
| `dem.cacheEntries`              | 2048  | `demCache`      | DEM tiles kept in memory                                                                    |
| `dem.abortDelayMilliseconds`    | 500   | `demAbortDelay` | Time a DEM load nobody waits for any more goes on before it is aborted                      |
| `imagery.contentCacheEntries`   | 512   |                 | Imagery pages kept in the cache of the imagery runtime. Each page holds a GPU texture layer |

## Elevation

| Setting               | Value   | URL                  | Effect                                                                                              |
| --------------------- | ------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `dem.tileCells`       | 256     |                      | Cells per side of a DEM tile                                                                        |
| `dem.interpolation`   | `cubic` | `interpolation`      | How DEM levels below the source are generated: `cubic`, `bilinear`, `linear` or `nearest`           |
| `dem.generatedLevels` | 3       | `demGeneratedLevels` | DEM levels generated below the deepest level of the source, from 0 to 8. 0 samples source ancestors |

## Imagery

| Setting                            | Value | URL                  | Effect                                                                                                                  |
| ---------------------------------- | ----- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `imagery.tileCells`                | 256   |                      | Texels per side of an imagery tile                                                                                      |
| `imagery.minLOD`, `imagery.maxLOD` | 3, 20 |                      | Levels of the imagery quadtree. The deepest level is also bounded by the source and by `demSubdivision`                 |
| `imagery.demSubdivision`           | 4     | `imagerySubdivision` | Imagery tiles per side of one physical DEM tile: 2, 4 or 8                                                              |
| `imagery.maxDrapeDepth`            | 4     | `kmax`               | Deepest drape below a terrain tile, up to `4^maxDrapeDepth` imagery pages per tile. `kmax` changes the mesh engine only |

## Engines

| Setting                           | Value | URL              | Effect                                                                            |
| --------------------------------- | ----- | ---------------- | --------------------------------------------------------------------------------- |
| `mesh.junctionBudgetMilliseconds` | 4     | `junctionBudget` | Main-thread time per frame for rebuilding the mesh grids whose neighbours changed |
| `gpu.pickCells`                   | 8     |                  | Cells per side of the grids the camera picks on the GPU engine                    |
| `gpu.maxInstanceDepth`            | 6     |                  | Deepest instance below its terrain tile on the GPU engine                         |
| `gpu.holdMilliseconds`            | 500   |                  | Time a coarsened imagery level stays in the instance cut of the GPU engine        |

The engines take the same values as options in code: `cells`, `maxDrapeDepth` and `junctionBudgetMilliseconds` for `MeshTerrainEngine`; `cells`, `maxInstanceDepth`, `holdMilliseconds`, `elevationPageSize` and `pickCells` for `GpuTerrainEngine`. An option given in code wins over the file.

## Parameters of the example only

These URL parameters choose what the page shows. They have no entry in `terrain-config.json`.

| URL                     | Default                                | Effect                                                                                                                                |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`                | `mesh`                                 | Terrain engine: `mesh`, one CPU mesh per tile, or `gpu`, one grid instanced on the GPU                                                |
| `renderer`              | `webgl`                                | `webgpu` runs the WGSL shaders on the WebGPU engine of Babylon.js where the browser supports it, WebGL and the GLSL shaders otherwise |
| `antialias`             | on                                     | `0` draws without multisampling, whose edges depend on the hardware and the graphics API: the renderer comparison uses it             |
| `place`                 | `mont-blanc`                           | Place the camera orbits, an entry of `src/places.json`: `mont-blanc` or `yosemite` (Half Dome)                                        |
| `lat`, `lon`            | none                                   | Any other point the camera orbits, in degrees, in place of `place`. Both are required                                                 |
| `height`                | the place's, or 0 with `lat` and `lon` | Height of the point the camera orbits, in metres                                                                                      |
| `radius`                | 25000                                  | Initial distance from the camera to the point it orbits, in metres                                                                    |
| `pitch`                 | 60                                     | Initial pitch of the camera, in degrees                                                                                               |
| `scale`, `exaggeration` | 1                                      | Initial vertical scale. The slider of the panel changes it live                                                                       |
| `solid`                 | off                                    | `1` draws shaded terrain with a sun light instead of the wireframe                                                                    |
| `lighting`              | `terrain`                              | `ambient` lights the terrain uniformly, for a comparison                                                                              |
| `normals`               | `mapzen`                               | Normals of the GPU engine: `mapzen`, the Mapzen normal tiles, or `dem`, the gradients of the DEM                                      |
| `normalMaxLOD`          | 15                                     | Deepest level of the Mapzen normal tiles, from 0 to 15                                                                                |
| `imagery`               | `debug`                                | Imagery of shaded grids: `debug`, `none`, or the name of a local module in `src/local/`, which git ignores                            |
| `elevation`             | on                                     | `0` keeps the grids flat and requests no DEM                                                                                          |
| `junctions`             | `fine`                                 | Junction policy between levels of detail: `fine`, `coarse` or `none`                                                                  |
| `heights`               | `coarsest`                             | Height of edge vertices shared by several levels: DEM of the `coarsest`, `finest` or `average` level                                  |
| `balance`               | on                                     | `0` turns off the 2:1 quadtree balance, which keeps neighbouring tiles within one level                                               |
| `subtrees`              | none                                   | Terrain subtrees with their own deepest level, `lod/x/y/maxLOD` separated by commas, for example `13/4252/2920/13`                    |
| `monitor`               | on                                     | `0` turns off the monitoring overlay and its counters                                                                                 |

A new named place is one more entry of `src/places.json`, with its `latitude`, `longitude` and `height`.

## Values still set in code

These values of the example are not settings yet: changing them means editing `src/main.ts`.

| Value                                                      | Where                    |
| ---------------------------------------------------------- | ------------------------ |
| Closest camera distance, 500 m                             | `createGeospatialCamera` |
| Mapzen normal pages: 256 cached, 16 initial texture layers | `normalPages`            |

## The bench

`npm run bench:terrain` in `packages/tools` opens the example with `engine`, `solid=1`, `imagery=none`, `radius` and `pitch` for each view. It reads every other value from `terrain-config.json`, so a change of the file changes what the bench measures.
