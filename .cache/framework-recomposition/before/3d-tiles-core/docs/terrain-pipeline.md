# Terrain pipeline

**Status: proposal, step 1 in progress.** It realigns the renderers on [Terrain grids](grid.md). Sections marked "to decide" wait for a decision. What was tried and what failed is in the [terrain test log](terrain-test-log.md): read it before a new measurement.

Web Mercator and the cube index differ in three things only: how tiles are addressed and connected, how a tile coordinate becomes a position, and the direction heights move a point along. Everything else is one pipeline.

## Baseline

Measured on `main` (`3d-tiles-babylon` `a080a35`), headless Chrome, 1200 x 860, WebGL, no imagery, turning the camera for 8 s, one run each.

|                                                     | Mercator mesh | Mercator GPU   | Moon GPU, 40 km | South pole GPU, 8 km |
| --------------------------------------------------- | ------------- | -------------- | --------------- | -------------------- |
| Frames per second                                   | 118.6         | 118.1          | 32.8            | 21.0                 |
| Terrain CPU per frame, `beforeRender`               | 1.08 ms       | 0.46 ms        | 16.64 ms        | 17.61 ms             |
| GPU time, end of the run                            | 1.1 ms        | 0.8 ms         | 4.1 ms          | 4.9 ms               |
| Tiles or instances                                  | 38            | 37             | 909             | 945                  |
| Draw calls per frame                                | 37.6          | 1              | 1               | 1                    |
| Triangles per frame                                 | 18 891        | 22 292         | 518 393         | 504 185              |
| Uploads per frame                                   | 25 KiB        | 188 KiB        | 1 322 KiB       | 3 597 KiB            |
| GPU memory of the terrain                           | 4 MiB         | 17.2 MiB       | 72.8 MiB        | 202 MiB              |
| of which positions                                  | in meshes     | 1.1 MiB        | 18.2 MiB        | 18.2 MiB             |
| of which DEM pages                                  | none          | 16.1 MiB       | 54.4 MiB        | 183.7 MiB            |
| Edges with a `Same` / `Finer` / `Coarser` neighbour |               | 63 / 14 / 24 % | 80 / 7 / 13 %   | 76 / 8 / 16 %        |

These columns are not comparable: the views differ, and so does the quality (gap 6). They are the reference for later measurements of the same column. The harness of step 1 has its own baseline on the same commit, entry T6 of the [test log](terrain-test-log.md), with different paths and tile counts.

## Gaps with the contract

| #   | Contract                                            | Today                                                                                                                                                                                                   | Where                                                  |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Shared variants `Coarser`, `Same`, `Finer`          | The GPU engine has one grid, `Finer` on its four edges, whatever the neighbours. 576 triangles per instance against 512 for the regular grid, although 7 to 14 % of the edges have a finer neighbour    | `terrain/gpu/instanced-grid.ts`, `refinedGridTopology` |
| 2   | Exactly one tile adapts, by connectivity            | The GPU engine moves midpoints in the shader, leaving degenerate triangles. `junctions` of the example does not apply to it                                                                             | `instancedGrid.vertex.glsl`, `positionAt`              |
| 3   | A topology carries no position, adapters project it | Textures of positions: one layer per Mercator row, one per cube tile. `grid.md`, "A shape", was added to describe this code, not the other way round                                                    | `terrain/gpu/grid-shapes.ts`, `docs/grid.md`           |
| 4   | One engine                                          | The example forces `gpu` on the Moon and `mesh` by default, so the projections are never compared on one engine                                                                                         | example `main.ts`                                      |
| 5   | Common policies                                     | Tiling switches: `RADIAL_HEIGHTS`, `coverRoots`, `terrainDataLevel`, `horizon`, `frustumMargin`, `workingSetFactor`                                                                                     | runtime, engine, example                               |
| 6   | Same quality                                        | Mercator derives its error from 256 cells per tile and the cube from 16, for grids of 16 cells in both. At one threshold, Mercator refines far less. Open, see [Decision 5](#decision-5-cells-per-grid) | `terrain/grid-source.ts`, example `main.ts`            |
| 7   | Work follows changes                                | The whole cut and instance buffer are computed again at almost every frame while the camera turns, and the whole buffer is uploaded at least twice per change                                           | `gpu-terrain-engine.ts`, `rebuild`, `place`            |

## Invariants

They hold for every projection and every backend.

### Selection

1. The runtime selects a cut of the quadtree, balanced to one level across edges through `ITileTopology`, faces included.
2. The cut is computed for a camera that has since moved. The renderer selects in a frustum wider than the view and draws a whole cover (`completeTileCover` of `@spacexr/raster`) where a whole cover is possible.
3. One horizon test: the horizons of the camera and of the highest point of the tile over a sphere below the lowest terrain.

### Junctions

4. Each edge has a level relative to the tile, from `ITileTopology`: `Coarser`, `Same` or `Finer`. Turns and reversals between faces belong to the topology and never reach a triangulation.
5. Exactly one tile of a junction adapts, by a policy common to projections and backends: the fine tile, [Decision 1](#decision-1-which-tile-adapts).
6. Topologies are cached and shared, and drawn once per group of tiles using them: one interior and line patches, see [Decision 2](#decision-2-whole-variants-or-one-grid-and-line-patches).
7. Corners exist at every level, so a vertex of the cube, with 3 tiles, needs no mechanism of its own.

### Positions

8. A position is `center + offset(uv, tile)`, along the body-fixed axes. `center` is computed in double precision on the CPU, relative to an origin near the camera. `offset` is computed from the UV of the topology and compact parameters of the tile.
9. No texture of positions. Stored relief is DEM heights.
10. `offset` is written as differences of small quantities, never as the difference of two positions at the scale of the body. See [Precision](#precision).
11. Heights move a point along the direction of the surface: geodetic for Web Mercator, radial for the cube.

### Heights

12. A vertex shared by tiles has one height, whichever tile computes it.
13. A tile reads the deepest data at its place, never levels interpolated for display.
14. Where two tiles read data of different levels along an edge, both read the coarser one along it. Where the data nests, this changes nothing: see [Nested heights](#nested-heights).

### Normals

15. A normal comes from the gradient of the heights over the samples of the source, by central differences, independently of the triangulation.
16. Both sides of an edge compute the same slope: the sample beyond an edge is read across it, turned across a face (to decide, [Decision 3](#decision-3-slope-across-pages)).

### Work

17. Work follows changes: a tile that changes level updates that tile and the neighbours whose edge level changes. A moving camera moves one origin, not every instance.

### Motion

18. A tile refines above a threshold in pixels, and coarsens below that threshold minus a hysteresis. While the camera moves fast, the threshold of new refinements rises with its apparent speed on screen, since nobody has the time to see that detail. Tiles already refined do not coarsen for it, and refinements the balance requires still happen. When the camera stops, the threshold comes back and the view refines.

## Pipeline

| Stage    | Input             | Output                                      | Differs by projection |
| -------- | ----------------- | ------------------------------------------- | --------------------- |
| Select   | camera, tileset   | cut, cover                                  | topology              |
| Connect  | cut               | level of each edge, data level of each edge | topology              |
| Group    | edge levels       | tiles per variant                           | nothing               |
| Place    | tile              | center, compact parameters                  | surface               |
| Offset   | UV, parameters    | offset from the center                      | surface function      |
| Displace | DEM page, area    | height along the surface direction          | surface function      |
| Shade    | DEM page, imagery | normal, colour                              | surface function      |

A backend decides where these run, not what they compute.

| Choice of backend       | Mesh                           | GPU instances               |
| ----------------------- | ------------------------------ | --------------------------- |
| Offset and displacement | CPU, written in vertex buffers | vertex shader               |
| Heights                 | CPU arrays                     | texture array pages         |
| Groups                  | one mesh per tile              | one draw per variant in use |

Both run both projections, so that they can be compared at the same quality on the same camera path.

## Precision

`offset` was tested at every level by emulating 32-bit floats at each operation (`Math.fround`) against double precision, 400 random tiles per level. Worst error in metres on the Moon:

| Level | Tile     | Position minus centre | Written as differences | Shared edge |
| ----- | -------- | --------------------- | ---------------------- | ----------- |
| 0     | 2 730 km | 0.079                 | 0.060                  |             |
| 6     | 43 km    | 0.310                 | 0.0048                 | 0.0097      |
| 10    | 2.7 km   | 0.284                 | 0.00035                | 0.00060     |
| 15    | 83 m     | 0.286                 | 0.000011               | 0.000016    |

With `tan a - tan c = sin(a - c) / (cos a cos c)` and the same step for the norm of the vector, the error follows the size of the tile and not the radius of the body. At the scale of the Earth, Web Mercator written the same way gives 0.000017 m at level 18, and the cube 1 m with the direct formula.

Not covered: the emulation assumes correctly rounded trigonometry, and GPUs may do worse. Edges across cube faces were not tested. Only a sphere was tested for the cube: a reference surface with three radii needs the same treatment of its radius. Step 2 of the [plan](#plan) measures this on a GPU first.

## Nested heights

Heights at the shared lattice points of a tile and its four children, on the tile service of the Moon:

| Levels                                                        | Mean   | Largest |
| ------------------------------------------------------------- | ------ | ------- |
| 3 / 4, 5 / 6 on two faces, 7 / 8 and 10 / 11 in the polar cap | 0.00 m | 0.00 m  |
| 6 / 7 in the polar cap, where the source changes              | 2.13 m | 70 m    |
| 0 / 1                                                         | 55.7 m | 1 899 m |

Only these pairs were tested. Where a source nests, a fine tile and a coarse tile already agree at shared vertices, and the DEM across is only needed where the source changes. Sources in `area` registration, such as Terrarium, were not tested.

## Decisions

### Decision 1: which tile adapts

- **The fine tile**, `Coarser` on its edge, the default of the mesh engine today. Its edge becomes straight between shared vertices and needs no extra height. Only 16 of the 81 variants are in use.
- **The coarse tile**, `Finer` on its edge. Relief stays finer along edges, but midpoints need the heights of the finer tiles.

**Decided: the fine tile.** It removes the most triangles and is the simplest policy for heights.

### Decision 2: whole variants, or one grid and line patches

Computed on the topologies of `@spacexr/grid`, for grids of 4, 8, 16 and 32 cells, over the 81 combinations:

- The triangles present in every combination form one interior grid.
- Everything else belongs to one patch per edge, one line of triangles, and each patch depends on the level of its own edge only.
- An interior and four patches give exactly the triangles of each of the 81 variants.
- A quarter turn about the centre sends the patch of an edge onto the patch of the next one, and the interior onto itself, because the diagonals alternate.

**So corner pieces are not needed**: `grid.md` gives corners 9 variants because it groups the triangles touching a corner, but each of these triangles depends on one edge.

For 16 cells:

|                                      | 16 whole variants, fine tile adapting | Interior and patches           | Today, refined on 4 edges |
| ------------------------------------ | ------------------------------------- | ------------------------------ | ------------------------- |
| Topologies in memory                 | 81 KiB                                | 5.6 KiB, the 3 levels included |                           |
| Draw calls                           | up to 16, 9 seen                      | 3, or 4 with `Finer`           | 1                         |
| Instances per tile                   | 1                                     | 5                              | 1                         |
| Triangles per tile, all `Same`       | 512                                   | 512                            | 576                       |
| Vertices shaded per tile, all `Same` | 289                                   | 353                            | 353                       |
| A change of edge level               | moves the tile to another group       | changes one patch              | rewrites attributes       |
| A change of policy                   | other variants                        | none                           |                           |

| Patch or part | Triangles | Vertices |
| ------------- | --------- | -------- |
| Interior      | 448       | 253      |
| `Coarser`     | 8         | 17       |
| `Same`        | 16        | 25       |
| `Finer`       | 32        | 41       |

In the views measured, 26 to 57 % of the tiles have all their edges `Same`, 9 variants are in use out of 16, and each rebuild changes about 2 % of the tiles on the Moon, 5 % on the small Mercator cut.

- **Cost of patches**: 22 % more vertices shaded per tile, each reading its heights, and 5 instances per tile. Instances then hold a tile index and a quarter turn, the parameters of a tile being stored once in a table, which adds a fetch per vertex.
- **A limit**: the interior holds the even vertices of each edge. Where a source changes across an edge (invariant 14), it needs the data of that edge as well, so edge references stay in the table of the tile and not in the patch.

**Decided: interior and patches**, measured against whole variants on the same paths at step 3. A regular grid for tiles with all edges `Same` could remove the extra vertices of 26 to 57 % of the tiles, at the cost of one more draw call, and is only worth adding if the measurements ask for it.

`grid.md`, whose split pieces have corners, changes once step 3 has confirmed this choice.

### Decision 3: slope across pages

- **Read across**, as the fragment shader does today for coarser neighbours: more references per instance, and no change to pages.
- **A gutter of one sample per page**: pages hold the sample beyond each edge, written from the neighbours. The shader stays simple, but a page changes when a neighbour arrives.

To be measured before choosing: the seam between tiles of one level has not been measured yet.

### Decision 4: the mesh backend

- **Kept**, running both projections, as a reference for comparisons and a fallback.
- **Removed** once the GPU backend covers everything.

**Decided: kept until step 5**, since it is the reference that proves the others. It now runs both projections.

### Decision 5: cells per grid

**Decided: 64 cells**, `grid.cells` in `terrain-config.json` of `3d-tiles-babylon`. Nothing fixed the value before: `grid.md` writes `(cells + 1)^2` without one, `GRID_SUBDIVISIONS = 16` dated from the first Babylon commit without a justification, and SpaceXR defaults to 32 and lets the application choose. A DEM tile has 256 cells, so a grid of 64 reads one sample in 4 in each direction and reaches them all 2 levels deeper.

Measured on the Moon, GPU engine, same error per cell, five paths and one machine: entry T10 of the [test log](terrain-test-log.md).

| Cells per side | Vertices per tile | Triangles per tile | Instances  | Triangles per frame | Frames per second | Largest visible gap, in motion |
| -------------- | ----------------- | ------------------ | ---------- | ------------------- | ----------------- | ------------------------------ |
| 16             | 289               | 512                | 603 to 930 | 0.4 M to 0.5 M      | 17 to 32          | 837 m                          |
| 32             | 1 089             | 2 048              | 366 to 447 | 0.8 M to 1.0 M      | 33 to 90          | 76 m                           |
| 64             | 4 225             | 8 192              | 204 to 273 | 1.6 M to 2.2 M      | 35 to 99          | none seen                      |
| 256            | 66 049            | 131 072            | 63 to 105  | 6 M to 14 M         | 1.2 to 94         | none seen                      |

All end with no gap and no hole at rest. 256 is held back while the cut changes, by textures of positions that step 2 removes, a cause not yet measured apart: to measure again after step 2.

**The geometric error follows the cells of the real grid, on both projections.** Web Mercator declared 256 cells for a grid of a different size, which had no reason to exist. The only setting of finesse left is the threshold in pixels. At rest it stays at 10 pixels, which shows the relief, and new refinements wait up to 40 pixels while the camera moves fast (invariant 18): entries T16 and T17 of the test log.

## Plan

Each step is a pull request, measured against the previous one with the same harness.

1. **Harness and quality.** Move the probes into the repository: fixed camera paths, holes, shared edges, CPU, GPU, instances, memory, uploads. One geometric error for both projections, which changes the Mercator baseline (gap 6) and waits for [Decision 5](#decision-5-cells-per-grid). The mesh backend on the cube.
2. **Positions on a GPU.** `offset` for both projections, compared with today's textures in a debug mode, across cube faces, at the poles and the vertices of the cube. Then remove the textures.
3. **Topologies.** The junction policy on the GPU backend, without midpoints in the shader: interior and patches against whole variants, on the same paths.
4. **Work.** Incremental cut and connections, stable slots in instance buffers, one moving origin. Also the ancestor fallback of a tile whose DEM is not in memory at draw time, which opens gaps with its neighbour: entry T5 of the [test log](terrain-test-log.md).
5. **One engine.** Remove the tiling switches, and make one backend the default for both projections.
6. **Documentation.** `grid.md` and `draping.md` hold the invariants, and backends describe their choices.

## Validation

| Subject                        | Check                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Level junctions                | positions of both sides of each edge, in 3D, at every frame of a path                                              |
| Edges between faces            | the same, on the 12 edges, including turned ones                                                                   |
| Poles and vertices of the cube | the same, and corners of 3 tiles                                                                                   |
| DEM of different resolutions   | the border of the polar cap, a source without nesting, data deeper on one side                                     |
| Holes                          | background pixels below the terrain, on every path                                                                 |
| Performance                    | same backend, resolution, quality and camera path: CPU, GPU, instances, triangles, memory, uploads, measured apart |
| Web Mercator                   | visible changes measured and stated                                                                                |

Comparing the two projections needs paths of equal apparent motion over terrain of equal complexity. A fixed seed and recorded paths keep runs reproducible.
