# Terrain test log

What was tried on the terrain pipeline, what it gave and what not to try again. Read it before a new measurement, and add an entry after each one, failures first. Companion of [Terrain pipeline](terrain-pipeline.md).

## Do not repeat

| Tried                                                                       | Why not again                                                                                                                              | Entry |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| A geometric error computed from cells the grid does not have                | The error must follow the real grid. The only setting of finesse is the threshold in pixels. The `errorCells` parameter of T15 was removed | T16   |
| A setting hard-coded in the code                                            | They live in `terrain-config.json` of `3d-tiles-babylon`. URL parameters only override them for a measurement                              | T16   |
| Stopping the harness with the task tool alone                               | Its processes keep running, and the next run measures next to them. Check and stop them first                                              | T16   |
| Reading the GPU seam figures of T10 to T17 as a validation                  | The probe was written for 16 cells: at other sizes it read 33 points of 129 and got midpoints wrong. See T18                               | T18   |
| Terrain grids of 16 cells                                                   | Ruled out for good by the project owner on 2026-11-06, after T10, T11 and T15. Do not measure or compare them again                        | T10   |
| Mercator declaring 16 cells per tile, with `maxScreenSpaceError` 10, online | Never settles, 10 to 16 FPS, at least 103 048 requests. Declaring 64 needs a larger DEM cache, see T15                                     | T9    |
| Hysteresis or a longer delay as the cure for a full DEM cache               | On Mercator they leave the repeated requests and gaps. The cache size removes them                                                         | T15   |
| Larger caches as the cure for holes during navigation                       | Large budgets did not remove the holes of T2, whose cause was the moved camera. A full DEM cache is another matter: see T15                | T2    |
| Selecting tiles without a frustum                                           | The artefacts almost disappear, then 6 FPS and a crash of the viewer                                                                       | T3    |
| Gradients read from generated levels                                        | Bilinear generated levels give facets. Normals read the samples of the source                                                              | T1    |
| Judging shared edges while tiles still rebuild                              | Up to 110 m reported "at rest" were a rebuild backlog. Wait for nothing pending                                                            | T7    |
| Judging gaps without separating the view from the rest                      | 700 to 3 500 m on the GPU engine were mostly tiles out of view                                                                             | T5    |
| Comparing with `main` without proving which code is served                  | A failed `git stash` made one comparison invalid                                                                                           | T4    |
| Experiments on code served by the dev server, unannounced                   | They reach any page open on that server, and misled a reading of the results                                                               | T3    |
| One run as a verdict on small differences                                   | `plain/gpu` gave 22.7 then 51.5 FPS, and 780 then 366 instances, between runs of the same code                                             | T6    |
| Reading a run whose `load s` is about 1 s or less, or that draws nothing    | The page was not loaded, or had failed: 120 FPS on 0 triangles, 109 FPS on 19 instances. The harness now rejects both                      | T10   |
| Running the harness before type checking                                    | A missing import stopped the GPU engine, and the harness waits 60 s per page before going on                                               | T9    |
| Reading `Material.shaderLanguage` to know what a material runs on WebGPU    | It reports WGSL for any material on WebGPU, a `ShaderMaterial` compiling GLSL included. Read `shaderLanguage` of the compiled effect       | T27   |
| Comparing WebGL and WebGPU images with multisampling                        | 99 % of the differing pixels are edges resolved by the hardware and the graphics API, not the shaders. The comparison passes `antialias=0` | T27   |
| A `forceGLSL` option as the reference of the WGSL                           | Rejected by the project owner on 2026-11-07: the comparison is WebGL from GLSL against WebGPU from WGSL                                    | T27   |
| Reading the GPU `edge m` columns from 2026-11-07 to T28                     | The probe read the references of one instance grid for all of them: 3 to 8 km reported where the engine drew none. Fixed in T28            | T28   |
| The terrain bench with `renderer=webgpu`                                    | It counts uploads through WebGL `bufferData` and stops on WebGPU. WebGPU is checked by `npm run compare:renderers`                         | T28   |

## How to measure

The harness is `packages/tools/src/terrain-bench` of `3d-tiles-babylon`. It needs Node.js 22, the example served on port 5174 and, for the Moon, the tile service. It runs headless Chrome, 1200 x 860, WebGL, `solid=1`, `imagery=none`. A path is run twice on a fresh page: once for performance, once for integrity.

```bash
npx tsx src/terrain-bench/cli.ts --dataset http://127.0.0.1:8793 --only "^plain/(mesh|gpu)$" --seconds 8 --label name --out file.json --compare reference.json
```

- **Traffic:** the `mont-blanc` paths reach Mapzen on `s3.amazonaws.com`, which is free. A page is cut off from tile servers after `--max-requests`, 5000 by default, to catch a runaway loop.
- **Raw reports** are in [terrain-tests](terrain-tests/), named after the entry. Older entries have no raw report, and their figures come from the notes of the session.
- **Holes** are background pixels below the terrain, one column in eight. **Edge** figures are the largest distance between vertices tiles share, in metres: visible, anywhere, and at rest once nothing is pending.

## Entries

### Before core #28 and Babylon #15

#### T1. Facets on the Moon, close up

- **First reading:** the limit of the data, about 170 m between samples. It was wrong.
- **Cause:** the gradient read bilinear generated levels.
- **Result:** reading the samples of the source removed the facets, now invariant 15 of the pipeline.

#### T2. Holes during navigation and the cache

- **Tried:** large cache budgets.
- **Result:** the holes stayed. The cache was not the cause. `workingSetFactor`, a cache following the size of the view, was added at the request of the project owner for another reason: a fixed budget does not fit every view.

#### T3. Holes at the edges of the image while turning

- **Tried:** a temporary selection without frustum, on the code served to a page open at the same time, without announcing it.
- **Result:** the artefacts almost disappeared, then 6 FPS and a crash of the viewer. The change seen on that page was first read as a fix.
- **Kept:** the cause is a cut computed for a camera that has moved. The merged answer is `frustumMargin` 0.25 and `completeTileCover`, not the removal of the frustum.

### Step 1, 2026-11-06

#### T4. Rewriting the mesh engine on `ITerrainTiling`: is Mercator unchanged?

- **Invalid first run:** a failed `git stash` and a wrong check of the served code. The two sides of the comparison were not what they claimed.
- **Second run:** a proof that follows the imports rewritten by Vite down to the file served, on `main-1..3` against the new code.
- **Result:** GPU views identical. Mesh views differ only in the boxes of the debug labels, whose anchor moved to `tiling.center`: terrain identical to the pixel, confirmed by maps of the differences.

#### T5. First run of the harness: 700 to 3 500 m on the GPU engine

- **First reading:** a bug of the probe. It was not one.
- **Cause:** the ancestor fallback of a tile whose DEM is not in memory at draw time reads a coarser page than its neighbour. Those tiles are mostly in the cover, out of view.
- **Kept:** reports separate visible gaps from all gaps.
- **Still open:** this defect comes from the ancestor fallback on `coverRoots`, and some cases are visible (23.9 m on `plain`). To treat at step 4.

#### T6. Baseline on `main`, `3d-tiles-babylon` `a080a35`, 8 s per path

Raw report: [T6-main-a080a35.json](terrain-tests/T6-main-a080a35.json).

| Path                 | FPS   | Terrain ms | GPU ms | Instances | Triangles | Upload KiB | GPU MiB | Holes | Edge m  |
| -------------------- | ----- | ---------- | ------ | --------- | --------- | ---------- | ------- | ----- | ------- |
| mont-blanc/mesh      | 117.8 | 0.67       | 1.05   | 42        | 18 532    | 19.5       | 4       | 18    | 0       |
| mont-blanc/gpu       | 118.9 | 0.24       | 0.79   | 45        | 21 824    | 117.6      | 17.2    | 0     | 0       |
| mont-blanc-zoom/mesh | 110.9 | 0.91       | 1.16   | 41        | 20 333    | 26.9       | 4.3     | 74    | 43.463  |
| mont-blanc-zoom/gpu  | 113.9 | 0.29       | 0.85   | 40        | 23 527    | 162.8      | 17.2    | 0     | 0       |
| plain/gpu            | 51.5  | 8.74       | 3.12   | 366       | 299 313   | 882.2      | 72.8    | 0     | 13.008  |
| plain-zoom/gpu       | 19.6  | 27.89      | 7.5    | 1 413     | 497 041   | 2 531.5    | 150.1   | 0     | 316.371 |
| face-edge/gpu        | 24.7  | 18.79      | 4.39   | 780       | 485 001   | 1 964.6    | 100.1   | 0     | 0       |
| turned-edge/gpu      | 20.7  | 21.45      | 4.27   | 618       | 433 280   | 1 980.1    | 100.1   | 0     | 351.684 |
| cube-vertex/gpu      | 21.4  | 21.23      | 4.85   | 651       | 416 368   | 1 881.2    | 100.1   | 0     | 41.336  |
| pole/gpu             | 21    | 16.28      | 4.17   | 516       | 352 378   | 2 365.4    | 140.9   | 0     | 659.172 |
| cap-border/gpu       | 28.4  | 14.9       | 4.08   | 660       | 361 955   | 1 948      | 100     | 0     | 59.805  |

**Variance is strong.** The same code gave `plain/gpu` at 22.7 then 51.5 FPS, 780 then 366 instances, and 17.9 FPS with 678 instances on a 4 s run. The camera follows time, so a slower run sees other tiles. Conclude only on large differences or several runs.

#### T7. The mesh engine on the cube: gaps of 117 to 201 m

Raw reports: [T7-mesh-first.json](terrain-tests/T7-mesh-first.json), [T7-at-rest-too-early.json](terrain-tests/T7-at-rest-too-early.json), [T7-settled.json](terrain-tests/T7-settled.json).

- **First result, in motion:** no console error, but 117 to 201 m between visible shared vertices and 1 to 5 hole pixels, on 14 to 16 FPS.
- **At rest, too early:** 58 to 110 m remained 1.5 s after the end of the path. The worst pairs were tiles whose edge levels were out of date: the rebuild queue, at 4 ms per frame, was not finished. Nothing is wrong with their heights.
- **At rest, nothing pending** (`junctionsDirty` false, 3 s paths):

| Path             | Settles in | Edge m, in motion | Edge m, at rest | Holes at rest |
| ---------------- | ---------- | ----------------- | --------------- | ------------- |
| plain/mesh       | 3.5 s      | 117.574           | 0               | 0             |
| turned-edge/mesh | 6.8 s      | 227.875           | 1.727           | 0             |
| cube-vertex/mesh | 4.1 s      | 74.609            | 0               | 0             |
| pole/mesh        | 6.4 s      | 10.766            | 0               | 0             |
| cap-border/mesh  | 4.0 s      | 65.473            | 0               | 0             |

- **Conclusion:** the gaps in motion come from that backlog, not from the rewrite. On the cube, about 350 tiles each need a rebuild after presentation, which a budget set for 40 Mercator tiles does not absorb.
- **Still open:**
  - 1.727 m on one corner of a face edge, levels `[3, 5, 6]`, seen on one run. A tile reads level 3 on its own face while the level 3 tile displayed may be on the other face. This is a candidate, not a verified cause.
  - GPU time of 12 to 33 ms while moving, against 2.7 to 3.9 ms shown on the same views at rest. Probably the buffers rebuilt in flight: not verified.

#### T8. Mercator at 256 cells, reference of T9

Raw report: [T8-mercator-256.json](terrain-tests/T8-mercator-256.json). Figures in T9.

#### T9. Mercator declaring 16 cells per tile: failure

- **Question:** gap 6. Mercator declares 256 cells per tile (`TILE_METRICS`) for a grid of 16, the cube 16. With the declared value equal to the grid, do both have one quality?
- **Change:** `tileSize: 16` in `TILE_METRICS`, `maxScreenSpaceError` left at 10, on the live Mapzen server. Reverted since.
- **Raw report:** [T9-mercator-16.json](terrain-tests/T9-mercator-16.json).

| 8 s per path         | FPS, 256 then 16 | Instances | Triangles       | Requests    | Load s    | GPU MiB     | Holes     |
| -------------------- | ---------------- | --------- | --------------- | ----------- | --------- | ----------- | --------- |
| mont-blanc/mesh      | 118.1, 10.1      | 42, 157   | 18 535, 97 051  | 532, 17 871 | 5.6, 70.2 | 4, 8.8      | 6, 5 282  |
| mont-blanc/gpu       | 118.6, 13.1      | 45, 194   | 21 831, 122 405 | 541, 22 321 | 2.9, 68.6 | 17.2, 185.4 | 0, 7 217  |
| mont-blanc-zoom/mesh | 108.3, 12.5      | 41, 309   | 20 239, 90 626  | 548, 28 208 | 2.8, 67.7 | 4.2, 9.9    | 45, 5 911 |
| mont-blanc-zoom/gpu  | 110.2, 15.8      | 44, 364   | 23 490, 115 023 | 563, 34 648 | 2.3, 65   | 17.2, 185.4 | 4, 9 838  |

- **Result:** the page never settled. Both waits, 60 s at the opening and 60 s at the end of the path, ran out, so these figures describe a loading that does not end. They are not a verdict on a grid of 16 cells.
- **Traffic:** 103 048 requests in the performance passes alone. The integrity passes, and a first run stopped after the missing import, sent more that were not counted. The runs use `imagery=none`, so these should be DEM tiles, but hosts were not recorded. This volume should have been announced before the run.
- **Cause, not established:** a loop of evictions and reloads is the candidate. The DEM cache at 512 tiles proves nothing: it reads 512 at 256 cells too, with about 540 requests. The harness now counts distinct addresses, which can separate the two.
- **Other reading:** the 16 itself is a free choice, see [Decision 5](terrain-pipeline.md#decision-5-cells-per-grid). `grid.md` writes `(cells + 1)^2` without a value, the constant dates from the first Babylon commit without a justification, and SpaceXR defaults to 32.

#### T10. Grids of 16, 32 and 256 cells on the Moon

**First campaign, partly invalid.** Raw reports: [16](terrain-tests/T10-first-grid-16.json), [32](terrain-tests/T10-first-grid-32.json), [256](terrain-tests/T10-first-grid-256.json). The harness declared some pages ready 0.5 to 1.1 s after opening, when nothing had started loading yet: `pending` read 0 on an empty page. Those paths measured a page still empty or loading, such as `plain/mesh` at 16 cells, 109 FPS on 19 instances against 14 to 16 FPS on every other run. The rule is now at least one selected tile and nothing pending, three checks in a row.

This race may also explain the "variance" of T6: `plain/gpu` at 51.5 FPS on 366 instances could be such a run, since T6 did not record its load time. Not proved. The Moon figures of T6 are to be read with care.

**Second campaign, valid.** Harness corrected, same error per cell (`tileSize` equal to the grid), `maxScreenSpaceError` 10, 6 s per path, one machine. Every request went to `127.0.0.1:8793` only. The GPU engine was run twice at 16, 32 and 64, once at 256. Raw reports: `T10-grid-*.json` in [terrain-tests](terrain-tests/).

GPU engine, frames per second, first run then second:

| Path        | 16         | 32         | 64         | 256  |
| ----------- | ---------- | ---------- | ---------- | ---- |
| plain       | 25.9, 19.0 | 90.0, 66.9 | 71.0, 63.5 | 15.1 |
| plain-zoom  | 18.8, 17.8 | 32.5, 40.0 | 35.2, 35.7 | 1.2  |
| turned-edge | 18.3, 16.8 | 82.7, 74.7 | 92.1, 90.9 | 94.4 |
| cube-vertex | 22.2, 18.3 | 82.6, 74.6 | 99.3, 97.9 | 21.4 |
| cap-border  | 31.7, 25.6 | 83.1, 75.1 | 92.2, 88.5 | 71.5 |

GPU engine, range over the five paths:

|                                | 16             | 32             | 64             | 256             |
| ------------------------------ | -------------- | -------------- | -------------- | --------------- |
| Instances                      | 603 to 930     | 366 to 447     | 204 to 273     | 63 to 105       |
| Triangles per frame            | 366 k to 518 k | 761 k to 977 k | 1.6 M to 2.2 M | 6.0 M to 13.9 M |
| Terrain CPU per frame          | 13 to 29 ms    | 5 to 18 ms     | 2 to 20 ms     | 0.6 to 838 ms   |
| GPU time                       | 4 to 11 ms     | 4 to 24 ms     | 5 to 26 ms     | 7 to 13 ms      |
| Uploads per frame              | 1.9 to 3.0 MiB | 0.5 to 2.0 MiB | 0.2 to 1.7 MiB | 0.1 to 44 MiB   |
| GPU memory                     | 73 to 150 MiB  | 86 to 129 MiB  | 119 to 137 MiB | 402 to 603 MiB  |
| Requests                       | 687 to 1 027   | 449 to 588     | 247 to 308     | 88 to 138       |
| Requests beyond distinct tiles | 47 to 163      | 0 to 28        | 0              | 0               |
| Load                           | 4.7 to 5.4 s   | 3.9 to 6.1 s   | 3.7 to 8.3 s   | 8.9 to 26.4 s   |
| Largest visible gap, in motion | 836.6 m        | 76.0 m         | 0 m            | 0 m             |
| Gap and holes at rest          | 0              | 0              | 0              | 0               |

Mesh engine, frames per second, one run:

| Path        | 16   | 32   | 64   | 256 |
| ----------- | ---- | ---- | ---- | --- |
| plain       | 22.0 | 27.6 | 14.3 | 2.8 |
| plain-zoom  | 9.0  | 17.3 | 9.7  | 4.7 |
| turned-edge | 13.8 | 25.8 | 17.6 | 4.3 |
| cube-vertex | 18.0 | 31.3 | 12.1 | 4.4 |
| cap-border  | 26.8 | 39.2 | 21.4 | 4.6 |

On every path and size it ends with no gap and no hole at rest, but shows up to 599 m and 26 605 hole pixels in motion. Its CPU memory goes from 22-32 MiB at 16 to 507 MiB at 256, where it reaches the budget of the cache.

**Proved on these runs**

- **16 is the worst size on the GPU engine, apart from 256 on some paths.** 32 and 64 give 2.6 to 5.4 times its frames per second on the paths that turn, and about twice on the zoom, in both runs.
- **At 64, no gap was seen in the view in motion**, in both runs. At 32, two paths showed up to 76 m. At 16, up to 837 m.
- **At 16, tiles are requested several times.** The DEM cache of 512 tiles is full on every path at 16, on `cap-border` only at 32, and never at 64. That they were evicted between two requests is the likely reading, not observed directly.
- **The estimate of Decision 5 was wrong on triangles.** A larger grid does not keep them constant: they go from about 0.45 M at 16 to 2 M at 64 and up to 13.9 M at 256, since a coarser tile extends beyond what the view needs at its density.
- **This machine draws them without trouble once the cut is stable:** 256 reaches 94 FPS on 10 M triangles on `turned-edge`.

**Candidates, not proved**

- The gaps at 16 come from those evictions, through the fallback of T5. Both go away together at 32 and 64, which is a correlation only. T9 may be the same loop at a larger scale.
- The terrain CPU at 16 follows the number of instances, gap 7.
- The collapse at 256 (1.2 FPS and 44 MiB per frame on the zoom, 15 to 21 FPS on two other paths) comes from the textures of positions, of 513 x 513 texels, about 4 MiB per tile, which step 2 removes. Not measured apart. 256 should be measured again after step 2 before it is ruled out.

**Same quality?** Four cameras were captured settled, with imagery, at 16, 32 and 64. Two were looked at, scaled down to 780 pixels wide: [Tycho at 220 km](terrain-tests/T10-views-tycho-16-32-64.png) and [the south pole at 8 km](terrain-tests/T10-views-pole-16-32-64.png), where they look the same by eye. Pixels do differ on all four: above 8 / 255 on 0.7 to 4.2 % of the frame, the statistics panel included. Silhouettes and motion were not compared, so equal quality is not proved.

**Not covered:** a single machine, whose GPU may hide what a weaker one would show. Mercator at these sizes is not measured. `face-edge` and `pole` are not in this campaign.

**Decision:** 64 cells, chosen by the project owner, entry T11.

Bugs found on the way: `normals.push(...)` overflowed the stack of the mesh engine above about 100 000 values; fixed. A failed page read as 120 FPS on 0 triangles, and a page not loaded yet as 109 FPS; the harness now rejects the first and waits for the second.

#### T11. The Moon at the default of 64 cells, all paths

Raw report: [T11-moon-64.json](terrain-tests/T11-moon-64.json). 8 s per path, one run, against T6 on `main` for the GPU engine. `T6` used 16 cells and the harness before its corrections, so its `plain` may be a page not loaded (T10).

| Path        | GPU FPS, T6 then T11 | Instances  | Triangles      | GPU MiB  | Requests | Visible gap in motion, T6 then T11 | Mesh FPS |
| ----------- | -------------------- | ---------- | -------------- | -------- | -------- | ---------------------------------- | -------- |
| plain       | 51.5, 73.1           | 366, 213   | 299 k, 1 758 k | 73, 119  | 264      | 13.0 m, 0                          | 11.5     |
| plain-zoom  | 19.6, 44.3           | 1 413, 219 | 497 k, 1 716 k | 150, 137 | 266      | 316.4 m, 0                         | 7.7      |
| face-edge   | 24.7, 92.5           | 780, 270   | 485 k, 2 240 k | 100, 119 | 288      | 0, 0                               | 13.0     |
| turned-edge | 20.7, 96.8           | 618, 270   | 433 k, 2 244 k | 100, 119 | 288      | 351.7 m, 0                         | 16.9     |
| cube-vertex | 21.4, 80.6           | 651, 228   | 416 k, 1 906 k | 100, 119 | 248      | 41.3 m, 0                          | 21.7     |
| pole        | 21.0, 40.1           | 516, 303   | 352 k, 2 591 k | 141, 205 | 584      | 659.2 m, 273.1 m                   | 12.3     |
| cap-border  | 28.4, 97.4           | 660, 231   | 362 k, 2 005 k | 100, 119 | 311      | 59.8 m, 0                          | 19.5     |

- **At rest:** no gap and no hole on all 14 runs, both engines. The 1.727 m of T7 did not come back on `turned-edge`, which does not explain it.
- **The pole is the exception.** 273 m visible in motion, 19 tiles requested again, and the DEM cache full at 512, because the polar cap is deeper: it is the one path where the cache saturates at 64 cells, which supports the candidate of T10 without proving it. See T14: it did not come back on shorter paths.
- **The mesh engine is slower at 64 than at 16:** 7.7 to 21.7 FPS, and up to 32 424 hole pixels in motion on `plain-zoom`, since a rebuild costs 16 times more on the budget of 4 ms per frame. It stays a reference until step 5, not the engine to judge the size by.
- **GPU time** reads 8.6 to 21.7 ms here, against 4.8 to 25.5 ms on the same size in T10: it varies between campaigns, and only large differences count.

#### T12. Web Mercator with grids of 64 cells, its error still at 256 cells

Not a measurement: one reading of one page, with no camera motion and no reload, on the default view of the example with the mesh engine. No console error, 39 tiles selected against about 40 before, and the relief drawn with denser grids. Memory of the meshes: 67.7 MiB CPU and 47.2 MiB GPU, against 5.8 and 4 MiB in T6, which follows from 16 times the vertices. The harness has not run on Mercator at this size: frames per second, gaps and requests are unknown.

#### T13. Web Mercator declaring 64 cells, on one path

Announced and accepted beforehand, one path, limited to 3 000 requests per page. Reverted since. Raw report: [T13-mercator-64.json](terrain-tests/T13-mercator-64.json). Against T8, which had grids of 16 cells:

| `mont-blanc/gpu`, 8 s | T8, 16 cells, 256 declared | T13, 64 cells, 64 declared     |
| --------------------- | -------------------------- | ------------------------------ |
| FPS                   | 118.6                      | 68.1                           |
| Terrain CPU           | 0.29 ms                    | 1.83 ms                        |
| GPU time              | 0.81 ms                    | 6.2 ms                         |
| Instances             | 45                         | 117                            |
| Triangles per frame   | 21 831                     | 967 056                        |
| GPU memory            | 17.2 MiB                   | 52.6 MiB                       |
| Requests, distinct    | 541, not recorded          | 1 656, 1 170                   |
| Load                  | 2.9 s                      | 8.7 s                          |
| Holes, in motion      | 0                          | 1 418 pixels, 32 of 248 frames |
| Largest visible gap   | 0                          | 3 031.6 m                      |
| Gap and holes at rest | 0                          | 0                              |

- **Unlike T9, the page settles.** Both pages together sent 3 265 requests to `s3.amazonaws.com`, under the limit, with no error.
- **It breaks in motion.** Holes and gaps of 3 km, with the DEM cache full at 512 and 486 requests repeated, the same picture as the Moon at 16 cells.
- **Not decided:** gap 6 stays open. Web Mercator stays at 256 declared until the cause is known.

#### T14. Is the DEM cache the cause of the gaps?

On the Moon, local service only, GPU engine, 6 s per path, `demCache=2048` against the default of 512. Raw reports: `T14-*.json` in [terrain-tests](terrain-tests/).

| Path, grid      | Cache | FPS        | Requests, distinct | Visible gap in motion | Gap anywhere       |
| --------------- | ----- | ---------- | ------------------ | --------------------- | ------------------ |
| plain-zoom, 16  | 512   | 18.8, 17.8 | 841, 678; 818, 683 | 836.6 m, 316.4 m      | 836.6 m, 584.9 m   |
| plain-zoom, 16  | 2048  | 14.1       | 680, 680           | 0                     | 0                  |
| turned-edge, 16 | 512   | 18.3, 16.8 | 977, 900; 839, 763 | 679.7 m, 30.5 m       | 1 148.2 m, 539.7 m |
| turned-edge, 16 | 2048  | 21.9       | 790, 790           | 72.3 m                | 72.3 m             |
| cube-vertex, 16 | 512   | 22.2, 18.3 | 871, 791; 828, 765 | 46.0 m, 83.4 m        | 654.6 m, 654.6 m   |
| cube-vertex, 16 | 2048  | 23.4       | 779, 779           | 41.3 m                | 159.2 m            |
| pole, 64        | 512   | 33.2, 32.1 | 526, 522; 514, 513 | 0, 0                  | 0, 0               |
| pole, 64        | 2048  | 28.2, 33.1 | 521, 521; 528, 527 | 0, 0                  | 0, 0               |

- **Proved on these runs:** with a larger cache, tiles are no longer requested twice, and the largest gaps shrink: out of view from 540-1 148 m to 72 m on `turned-edge`, and from 655 m to 159 m on `cube-vertex`.
- **The cache does not explain everything.** Gaps of 41 and 72 m remain in the view at 16 cells with a cache that is not full, so another cause exists. The fallback of T5, while a page has not arrived yet, is the candidate.
- **The cache does not explain the gain of T10.** At 16 cells, frames per second stay at 14 to 23 with the larger cache: the gain of 64 cells comes from elsewhere, and fewer instances is the candidate.
- **The pole does not settle it.** The 273 m of T11 did not come back on 6 s paths, whichever the cache, and those paths barely fill it. T11 ran 8 s and sent 584 requests. The gap is intermittent.
- **Not tested:** Web Mercator with a larger cache, which would say whether T13 can be fixed this way.

#### T15. Back and forth between levels: hysteresis, delay, threshold and cache

- **Question, from the project owner:** a cache used intensively may come from unjustified back and forth between levels, not from its size.
- **Measure:** the harness now counts the tiles shown and hidden along a path, and those shown again within 2 s of leaving. A camera turning one way does not bring back a tile it has just left, so these **quick returns** are suspect. Some may still be justified, since the distance to a tile changes while the camera orbits, so they are an upper bound.
- **Setup:** 8 s per path, GPU engine, one run per line. Raw reports: `T15-*.json` in [terrain-tests](terrain-tests/).

Moon, grids of 64 cells, on `plain`, `cube-vertex` and `pole`:

| Setting                  | FPS         | Shown             | Returns       | Quick returns | Requests beyond distinct |
| ------------------------ | ----------- | ----------------- | ------------- | ------------- | ------------------------ |
| hysteresis 0             | 81, 93, 28  | 260, 216, 537     | 92, 81, 148   | 37, 7, 77     | 0, 0, 18                 |
| hysteresis 0.2, delay 20 | 92, 99, 56  | 245, 205, 508     | 72, 63, 124   | 21, 7, 55     | 0, 0, 18                 |
| hysteresis 0.4           | 71, 102, 47 | 238, 210, 529     | 59, 51, 133   | 20, 7, 60     | 0, 0, 18                 |
| delay 0                  | 81, 102, 50 | 238, 192, 415     | 69, 63, 106   | 18, 7, 43     | 0, 0, 4                  |
| delay 120                | 92, 114, 14 | 241, 219, 500     | 64, 59, 97    | 23, 7, 51     | 7, 0, 7                  |
| grid of 16, default      | 65, 22, 22  | 1 549, 1 544, 927 | 369, 324, 272 | 223, 220, 208 | 0, 187, 790              |

Web Mercator, `mont-blanc/gpu`, grids of 64 cells:

| Setting                              | FPS   | Instances | Triangles | Requests, distinct | Quick returns | Holes in motion  | Visible gap |
| ------------------------------------ | ----- | --------- | --------- | ------------------ | ------------- | ---------------- | ----------- |
| 256 declared, today's default        | 120.1 | 45        | 322 k     | 541, 532           | 21            | 0                | 0           |
| 64 declared                          | 67.2  | 118       | 950 k     | 1 615, 1 161       | 39            | 3 416, 33 frames | 1 193 m     |
| 64, hysteresis 0.4, delay 120        | 72.7  | 139       | 1 058 k   | 1 613, 1 178       | 31            | 1 247, 33 frames | 3 269 m     |
| 64, threshold 16 pixels              | 113.0 | 76        | 611 k     | 963, 756           | 26            | 1 811, 10 frames | 4 444 m     |
| 64, DEM cache 2048                   | 99.1  | 118       | 966 k     | 1 174, 1 174       | 40            | 56, 3 frames     | 0           |
| 64, cache, hysteresis 0.4, delay 120 | 95.3  | 138       | 1 042 k   | 1 179, 1 179       | 25            | 16, 7 frames     | 0           |

All these runs end with no gap and no hole at rest, and sent no error. Web Mercator runs went to `s3.amazonaws.com`, Moon runs to `127.0.0.1:8793`.

**Proved on these runs**

- **Back and forth exists.** On the Moon, 3 to 11 % of the tiles shown at 64 cells come back within 2 s, and 14 to 22 % at 16 cells. It is not incessant: no tile came back more than 4 times in 8 s.
- **On Web Mercator, it is not what fills the cache.** Hysteresis and delay leave the repeated requests at 435, against 454. A cache of 2048 alone removes them all, along with the gaps and most holes, and brings 67 FPS to 99.
- **The path needs more DEM tiles than the cache holds:** about 1 170 distinct tiles over one turn, for a cache of 512.
- **Hysteresis 0 is worse than 0.2**, on returns and on the pole. Going to 0.4 changes little.
- **The coarsening delay brings nothing measurable:** quick returns do not fall between 0 and 120 frames, and it counts frames, not time, so it protects for 0.17 s at 120 FPS and 1.3 s at 15 FPS. On the pole, 120 frames gave 14 FPS on 384 instances, on one run.
- **A higher threshold is no substitute:** at 16 pixels the cache stays full, with the largest gap of the table.

**Not proved**

- `changesAtRest` reads 0 everywhere, but the runtime may not recompute anything while the camera is still, so this does not prove the absence of oscillation at rest.
- At 16 cells, repeated requests on `pole` reach 790 and quick returns 208: back and forth may add to the eviction there. This table does not separate them.
- `plain` at 16 cells gave 65 FPS here against 19 to 26 in T10, with the same settings: an unexplained difference, which is another reason to read one run with care.

**Reading:** the DEM cache is fixed at 512 entries in the example, while `workingSetFactor` only makes the runtime cache adaptive. The adaptive cache asked for earlier does not cover the DEM.

#### T16. The threshold in pixels, on both projections

The error now follows the real grid on both projections, and the settings are in `terrain-config.json`, with a DEM cache of 2048 tiles. A cube imagery source that had inherited the cells of the terrain grid was corrected: its tiles have 256 texels. Two earlier starts of this campaign were stopped and thrown away, one for that imagery source and one for the DEM cache at 512, and left processes running that had to be stopped by hand. No report of theirs was kept.

Valid. GPU engine, grids of 64 cells, DEM cache of 2048, 8 s per path, one run per value. Raw reports: `T16-sse-*.json` in [terrain-tests](terrain-tests/).

| Path, threshold 10, 20, 40 pixels | FPS          | Instances     | Triangles                 | Requests        | Worst holes in motion |
| --------------------------------- | ------------ | ------------- | ------------------------- | --------------- | --------------------- |
| mont-blanc                        | 85, 120, 120 | 117, 59, 45   | 967 k, 506 k, 324 k       | 1 176, 632, 535 | 5, 0, 0               |
| mont-blanc-zoom                   | 87, 107, 113 | 140, 66, 44   | 1 006 k, 499 k, 344 k     | 1 176, 708, 556 | 9 658, 0, 0           |
| plain                             | 97, 111, 114 | 213, 156, 138 | 1 760 k, 1 290 k, 1 125 k | 264, 172, 144   | 0, 0, 0               |
| plain-zoom                        | 55, 80, 83   | 216, 135, 108 | 1 705 k, 1 175 k, 1 028 k | 275, 195, 163   | 0, 0, 0               |
| cube-vertex                       | 99, 113, 111 | 225, 186, 114 | 1 905 k, 1 521 k, 949 k   | 248, 188, 104   | 0, 0, 0               |
| pole                              | 38, 85, 73   | 303, 216, 189 | 2 602 k, 1 810 k, 1 637 k | 565, 393, 385   | 0, 0, 0               |
| cap-border                        | 94, 101, 98  | 231, 165, 129 | 2 002 k, 1 312 k, 1 148 k | 311, 183, 177   | 0, 0, 0               |

- **With the cache at 2048, the gaps are gone:** 0 m in the view in motion at every threshold on all seven paths, and no gap or hole at rest. No tile was requested twice, but for a handful on `mont-blanc` at 40 pixels (535 against 532).
- **Only one defect remains:** 9 658 hole pixels on 31 of 324 frames on the Mercator zoom at 10 pixels.
- **It confirms the equivalence:** Mercator at 40 pixels with 64 declared gives the 45 instances and 324 k triangles of "256 declared" in T15. They were the same selection.
- **Images,** settled, scaled to 780 pixels wide. [Mont Blanc at 25 km](terrain-tests/T16-views-mercator-25km-10-20-40.png) and [at 6 km](terrain-tests/T16-views-mercator-6km-10-20-40.png), relief alone, without imagery: sharp at 10, slightly softer at 20, clearly blurred with visible facets at 40. [Tycho](terrain-tests/T16-views-moon-tycho-10-20-40.png) and [the south pole](terrain-tests/T16-views-moon-pole-10-20-40.png), with imagery: almost the same at all three, since imagery carries most of the detail. So 40 pixels loses relief that shows, and more so without imagery.
- **Reading:** at rest, 10 pixels is what shows the relief. In motion, 40 pixels has no defect and costs far less. This is the case for a threshold following the speed of the camera, T17. `changesAtRest` of T15 proves nothing: reading the driver shows it runs no traversal while the camera is still.

#### T17. A threshold following the speed of the camera

- **Asked by the project owner:** without it, tiles refine for a result nobody has the time to see.
- **Change:** `refinementThresholdScale` and `requestFrame` of `TileRuntime`, and `MotionRefinementScale` driven by `BabylonRuntimeDriver`. New refinements wait up to 4 times the threshold at full speed. Tiles already refined do not coarsen for it, refinements the balance requires still happen, and the factor drops 300 ms after the camera slows down. Values are in `motion` of `terrain-config.json`.
- **Setup:** GPU engine, grids of 64 cells, threshold of 10 pixels, DEM cache of 2048, 8 s per path, two runs of each. The paths all reach full speed: the mean factor reads 3.99 to 4. Raw reports: `T17-*.json` in [terrain-tests](terrain-tests/).

| Path            | FPS, fixed | FPS, following speed | Requests, fixed then following | Triangles, fixed then following | Back to rest |
| --------------- | ---------- | -------------------- | ------------------------------ | ------------------------------- | ------------ |
| mont-blanc      | 58, 74     | 117, 115             | 1 170, 750                     | 958 k, 725 k                    | 0.4 s        |
| mont-blanc-zoom | 60, 96     | 114, 114             | 1 176, 672                     | 986 k, 525 k                    | 1 to 1.3 s   |
| plain           | 73, 93     | 99, 115              | 264, 192                       | 1 760 k, 1 502 k                | 0.4 s        |
| plain-zoom      | 50, 51     | 85, 94               | 270, 187                       | 1 707 k, 1 161 k                | 0.7 s        |
| turned-edge     | 102, 105   | 97, 113              | 288, 228                       | 2 244 k, 1 698 k                | 0.6 s        |
| cube-vertex     | 101, 100   | 117, 106             | 248, 204                       | 1 906 k, 1 764 k                | 0.3 to 0.6 s |
| pole            | 43, 46     | 89, 97               | 557, 446                       | 2 600 k, 2 067 k                | 0.5 to 0.7 s |
| cap-border      | 108, 106   | 98, 114              | 311, 251                       | 2 004 k, 1 707 k                | 0.4 s        |

- **In motion:** hole pixels on the Mercator paths fall from 29 and 55 to 0, and from 1 029 and 669 to 8 and 0 on the zoom. No gap in the view on any run, and none at rest.
- **At rest, the view keeps its threshold.** It presents fewer tiles than a fixed threshold, up to a third on the zoom, so the error on screen of each selected tile was read directly, on four paths, one run each:

| Path            | Selected, fixed then following | Mean error, pixels | Worst error, pixels |
| --------------- | ------------------------------ | ------------------ | ------------------- |
| mont-blanc-zoom | 131, 92                        | 4.92, 6.22         | 8.94, 9.85          |
| plain           | 84, 75                         | 5.84, 6.37         | 19.36, 19.27        |
| plain-zoom      | 102, 71                        | 4.14, 5.45         | 8.69, 9.90          |
| turned-edge     | 94, 79                         | 5.35, 6.04         | 9.65, 9.88          |

The fixed threshold was keeping tiles finer than needed, through its hysteresis, and following the speed leaves the view just under 10 pixels. This holds for these views only: images after a path were not compared.

**Not proved**

- 4 tiles at about 19 pixels on `plain`, with and without this mode, so it does not come from it. Their cause is not known.
- A real traversal at rest changes tiles on some paths, with or without this mode: up to 110 on `plain-zoom` fixed, 35 following the speed, over 15 forced frames. They may be coarsenings whose delay counts frames, which stop while the camera is still, or an oscillation. Not separated.
- Slow motion: the paths all run at full speed, so the range between the two speeds of the configuration is covered by tests only.
- Imagery does not follow the speed yet, and the mesh engine was not measured with it.
- One machine.

#### T18. After a code review, the seam probe corrected

A review of the code reported faults in the runtime and the engines, and each was checked and handled: see [Terrain review](terrain-review.md), which says what proves each one and what stays open.

**A fault in the results of this log.** `gpuSharedEdges` of the harness had `steps = 32`, the half-cell lattice of a grid of 16 cells, and read pages of 256 cells. When grids changed size, it did not follow. At 64 cells it read 33 of the 129 points of an edge, and applied its rule of midpoints at the wrong pitch, on heights rather than positions. So the "0 m" of the GPU engine in T10, T11, T15, T16 and T17 validate nothing, except at 16 cells. The holes, frames per second, requests and memory of those entries do not depend on it, and the mesh probe was not concerned.

The probe now follows the grid drawn, compares positions in double precision, and adds 100 m to one shared vertex at each integrity pass: `probeDetects` reads true, on about 40 000 shared vertices per check. It does not reproduce the floats of the shader.

All paths on both engines, one run: grids of 64 cells, threshold of 10 pixels following the speed, DEM cache of 2048, error of the real cells at each latitude, 8 s per path. Raw report: [T18-after-review.json](terrain-tests/T18-after-review.json).

| Path            | GPU FPS | GPU frame p95, p99 (ms) | GPU requests | GPU visible gap | Mesh FPS | Mesh frame p95, p99 (ms) | Mesh visible gap | Mesh worst holes |
| --------------- | ------- | ----------------------- | ------------ | --------------- | -------- | ------------------------ | ---------------- | ---------------- |
| mont-blanc      | 118.9   | 10.8, 17.5              | 608          | 0               | 72.6     | 30.2, 67.6               | 360.8 m          | 1                |
| mont-blanc-zoom | 112.9   | 11.3, 30.0              | 588          | 0               | 88.8     | 18.0, 60.2               | 217.3 m          | 104              |
| plain           | 114.4   | 12.5, 30.1              | 192          | 0               | 34.8     | 106.3, 132.9             | 341.9 m          | 0                |
| plain-zoom      | 92.9    | 19.3, 64.8              | 187          | 0               | 48.4     | 41.7, 170.9              | 22.4 m           | 2 880            |
| face-edge       | 79.8    | 22.8, 53.4              | 240          | 0               | 36.2     | 73.2, 136.5              | 214.1 m          | 0                |
| turned-edge     | 112.7   | 12.0, 27.6              | 228          | 0               | 57.0     | 42.5, 86.8               | 287.7 m          | 0                |
| cube-vertex     | 104.9   | 12.4, 28.9              | 204          | 0               | 39.2     | 33.3, 128.0              | 354.2 m          | 0                |
| pole            | 100.8   | 20.9, 58.0              | 451          | 0               | 45.6     | 63.3, 77.0               | 215.1 m          | 0                |
| cap-border      | 113.6   | 12.6, 27.8              | 251          | 0               | 52.1     | 41.8, 119.7              | 170.0 m          | 0                |

- **GPU engine:** no gap in the view on any path, with a probe that now sees one (`probeDetects` true on all 18 runs). Holes: 22 pixels on 1 frame of the Mercator zoom, none elsewhere.
- **At rest, both engines:** no gap and no hole on all 18 runs, within 0.3 to 2.7 s after the end of the path.
- **Nothing moves at rest any more.** `changesAtRest` reads 0 on all 18 runs, over 15 forced frames, against up to 110 in T17. So those changes were delayed coarsenings stopped with the camera, not an oscillation, and the delay in time settles them.
- **Mercator:** at the same threshold, it now presents 77 tiles at rest on `mont-blanc`, against 115 to 118 in T17: the error at 46 degrees follows the real size of the cells.
- **Passes of the balance:** up to 3 attempts per refinement of a frame on the mesh engine (`mont-blanc`, 72 for 22). Tiles entering the cut: 162 to 302 on a path.

**Not proved**

- **The mesh engine in motion:** gaps of 22 to 361 m and up to 2 880 hole pixels, on tiles waiting for their rebuild (`stale` true in the worst pairs), and p99 frames of 60 to 171 ms. It stays a reference until step 5, and it is still the default on Mercator in the example.
- **Tiles above the threshold at rest:** 4 at about 19 pixels on `plain`, 2 at about 11 pixels on `cube-vertex`, on both engines. Not explained.
- **One run, one machine, caches warm only within the page.** Images after a path were not compared.

#### T19. Images at rest, and the cancellation reaching the requests

- **Change:** `TilePyramid.load` takes a signal. A request withdraws, and a load nobody waits for any more is aborted, down to its HTTP request. A load another request still waits for goes on, and so does one without a signal. Both engines pass theirs. Paths now end at an exact pose, whatever the frame rate, so that images at rest compare.
- **Setup:** GPU engine, six paths, one run with the threshold following the speed and one fixed. Raw reports: `T19-*.json` in [terrain-tests](terrain-tests/).

| Path, at rest after 8 s | Pixels changed | Above 8 / 255 | Largest | Tiles presented, fixed then following |
| ----------------------- | -------------- | ------------- | ------- | ------------------------------------- |
| mont-blanc              | 1.05 %         | 0.422 %       | 53      | 79, 76                                |
| mont-blanc-zoom         | 1.37 %         | 0.100 %       | 25      | 74, 69                                |
| plain                   | 0.37 %         | 0.001 %       | 31      | 81, 75                                |
| plain-zoom              | 2.70 %         | 0.031 %       | 47      | 84, 72                                |
| turned-edge             | 1.10 %         | 0.005 %       | 20      | 93, 79                                |
| pole                    | 0.00 %         | 0.000 %       | 1       | 103, 103                              |

- **At rest, following the speed changes the image very little.** [Mont Blanc](terrain-tests/T19-views-mont-blanc-fixed-following.png), the largest difference, and [the plain after a zoom](terrain-tests/T19-views-plain-zoom-fixed-following.png), scaled to 780 pixels wide, look the same by eye. The images hold relief without imagery, which shows differences the most. Differences come from the tiles the fixed threshold keeps finer through its hysteresis.
- **No gap at rest, no hole at rest, on the 12 runs.** The probe saw its 100 m on all of them.

**Aborting has a cost, on one path.** On `mont-blanc-zoom` following the speed, 879 requests for 588 distinct tiles and 99 cancelled activations, against 588 requests for 588 in T18, before the abort. The zoom goes back over the tiles it just left, whose loads were aborted and start again. The others stay within 5 requests of T18. A short delay before aborting may keep both: not tried.

**Not proved**

- The frame rates of this entry are lower than T18 on paths without any cancellation: `plain` gives 80.7 FPS against 114.4. So this run says nothing about the speed of aborting. The cause is not known, and runs vary, or the machine was busier.
- One run of each. Images with imagery, and other poses, were not compared.

#### T20. A delay before a DEM load is aborted

- **Asked by the project owner,** after the cost seen in T19.
- **Change:** `abortDelayMilliseconds` of `TilePyramid`: a load nobody waits for goes on for this time, and a new request keeps it. Value in `dem` of `terrain-config.json`, `demAbortDelay` in the URL.
- **Setup:** GPU engine, threshold following the speed, 8 s per path, two runs of each value. Raw reports: `T20-*.json` in [terrain-tests](terrain-tests/).

| Requests for distinct tiles | 0 ms     | 500 ms   | 2 000 ms |
| --------------------------- | -------- | -------- | -------- |
| mont-blanc-zoom, 588 tiles  | 835, 759 | 588, 588 | 588, 588 |
| mont-blanc, 608 tiles       | 630, 636 | 608, 608 | 608, 608 |
| pole, 451 tiles             | 451, 474 | 451, 451 | 451, 451 |
| plain-zoom, 187 tiles       | 187, 187 | 187, 187 | 187, 187 |

- **500 ms removes every repeated request** on these paths, and 2 000 ms adds nothing. **Retained: 500 ms.**
- **Activations are still cancelled at once,** 0 to 70 per path at 500 ms, and give their load slot back: the delay only concerns the request behind them.
- **No gap in the view and none at rest** on the 24 runs, and the probe saw its 100 m on all of them. Holes in motion stay small and vary between runs: up to 150 pixels at 0 ms, none at 500 ms, up to 29 at 2 000 ms. Two runs do not separate them.
- **Frame rates:** 83 to 120 FPS at 500 ms. `plain-zoom` gives 94 and 83 FPS, and 90 and 65 at 0 ms. The slow frame rates of T19 did not come back on the same paths, which points to a busier machine then, without proving it.

#### T21. A habitat from a Blender scene on the 5 m DEM of Shackleton

- **Change:** `tileset=` of the example loads a tileset by HTTP, and `orbitalCamera` of `terrain-config.json` lets the camera come to 10 m from its point and 1.5 m above the terrain, instead of 500 m and 50 m. The habitat comes from `nuit9-shackleton.blend` of the CO2 scrubber film, through `scripts/export-shackleton-habitat.py` of the example.
- **Failed first:** the glTF exporter with `use_selection` alone took what was selected in the other scenes of the file, the terrain included: 125 MiB per file, 5 million triangles. With `use_active_scene`: 0.9 MiB and 44 340 triangles for the station, 3 MiB and 54 908 for the rover.
- **Placement, checked against the film:** the site at x = 25 100 m, y = -7 613 m of the south polar stereographic projection reads a radius of 1 737 562.0 m on the DEM of the tile service, where the film states 163 m over 1 737 400 m, so 1 737 563 m. The station stands at 1 737 562.03 m in the scene, as declared.
- **Ground:** the six feet stand on heights from -538.10 to -537.83 m. The station is level at their mean, so a foot floats or sinks by up to 14 cm. The film levels its ground, the DEM does not. The rover stands 0.415 m higher, on the DEM where it is parked.
- **Not measured:** the cost of the objects with the harness, and the frame rate beyond one reading of 120 FPS at rest and about 10 FPS while the terrain loads, on one machine. The levelled ground, the tracks, the night lighting, the sky and the Earth of the film are not reproduced.
- **Black metal, two causes:** the scene had no environment, and the brushed aluminium exported `KHR_materials_anisotropy` on meshes without tangents or texture coordinates. An environment alone left the aluminium black: only turning its anisotropy off in the page made it silver, so the export now sets it to 0. `objects-environment.ts` of the example builds the environment from its own JSON file, without any texture file: it stays out of the engine. With the lights off, the hull stays lit by it alone, and its first-order term is brighter toward the ground. It also needs `RegisterBaseTexturePolynomial`, which the materials do not call: without it the hull receives no diffuse light from the environment.
- **Not covered:** the up direction of the environment is the target of the page, like the lights: objects seen from a page opened far from them reflect a tilted horizon. The cost of the environment was not measured apart.

#### T22. A value of hysteresis on visibility, abandoned

- **Failed:** a `frustumHysteresis` of 0.25, chosen by hand, to keep a tile in use until it went further than the tile entering. On `ground-level`, 6 s, it gave 17.1 FPS and 47 ms of terrain per frame in its one complete run, against 81.4 FPS and 5.1 ms without. Removed, with the rule that a fix does not rest on a tuned value.
- **Failed, in the measure:** the page of the Browser pane is throttled while the pane is hidden or its session is not shown: pauses of 1 s, and 0 to 6 frames in 6 s. They said nothing about the engine. Use the harness.
- **Failed, in the harness call:** Git Bash rewrites `tileset=/moon-sites/...` into a Windows path, so the page could not fetch it. Set `MSYS_NO_PATHCONV=1`, and give `--out` as `C:/...`.
- **What the cost was not:** the 99 000 triangles of the habitat add less than 1 ms of CPU per frame. Hidden or not, `beforeRender` of the GPU engine costs the same.
- **What it was:** with a heading going back and forth, `rebuild` ran 233 times in 660 frames and gave the same list of drawn tiles 201 times, 1 808 ms in all. 186 requests came from `present` and `hide` of the terrain runtime, 47 from the pages of the imagery. 23 tiles came and went, 5 to 11 times each, from level 4 to level 13. The test of visibility had no hysteresis, and `coverFill` drew the tile that had left again.

#### T23. Active tiles

- **Change:** `visible` is now the view of the camera, without margin. `active` is visible, in the periphery of `frustumMargin`, or a child of a visible tile. Active tiles stay selected, refine and merge. Only visibility decides what waits: loads, ancestors brought into the view and the quadtree balance. No new setting.
- **Failed first:** an unloaded neighbour outside the view held back the refinement on screen through the balance, level 2 instead of 3. A test of the balance found it, and the balance now only reads visible tiles. The rule also ignored `preloadSiblings: false`, whose contract is that children outside the view do not load: the rule of children now follows that option.
- **Setup:** GPU engine, 6 s, one run per path, except 2 for `mont-blanc`. Raw reports: `T22-ground-0-b.json` and `T23-*.json` in [terrain-tests](terrain-tests/). The GPU time of `ground-level`, 4.87 and 4.66 ms, suggests a comparable machine. It does not for the older `plain` and `pole`, 11.1 and 16.1 ms against 3.1 and 4.6 ms: their frame rates are not compared.

| Path                                 | FPS   | p99 ms | Terrain ms | Rebuilds | Giving the same list |
| ------------------------------------ | ----- | ------ | ---------- | -------- | -------------------- |
| `ground-level`, before               | 81.4  | 51.1   | 5.07       | 231      | 204                  |
| `ground-level`, active               | 109.8 | 23     | 1.86       | 189      | 166                  |
| `ground-level-sway`, before          | 66.5  | 59.8   | 2.39       | 98       | 93                   |
| `ground-level-sway`, active          | 85.5  | 29.9   | 1.09       | 48       | 41                   |
| `ground-level`, active, habitat      | 92.8  | 32.9   | 3.28       | 176      | 153                  |
| `ground-level-sway`, active, habitat | 89    | 25.7   | 0.92       | 41       | 35                   |

- **Not solved:** most rebuilds still give the same list, 166 of 189 turning one way.
- **Worse:** tiles shown again within 2 s, which a camera turning one way should not bring back. `mont-blanc` 75 and 78 against 11 in T18 and T20, `plain` 74 against 14 in a run of 8 s, `pole` 60 against 35. Not explained.
- **Not explained:** with the habitat, 747 and 657 hole pixels in motion on the two paths, 0 at rest and 0 without the habitat. The probe counts background pixels below the terrain, and may be misled by the objects. Not checked.
- **Integrity without the habitat:** no hole and no gap, in motion and at rest, on the 5 paths, and the probe saw its 100 m. Changes with a still camera: 55 then 0 on `mont-blanc`, a figure that already varied from 0 to 15 before.
- **Not measured:** the mesh engine, and what `mont-blanc` costs at the same load as before.

### Base selection, 2026-11-07

#### T24. Holes while zooming on `mont-blanc-zoom`

- **First reading:** parent tiles hidden before their children are drawn. It was not that: the runtime shows entering tiles before it hides leaving ones, and no hole frame had a `present` or a `hide`.
- **Measured:** a temporary probe of the harness, 6 s, both engines. 13 hole frames on the mesh engine, worst 10 477 pixels; 12 then 29 on the GPU engine, worst 24 152. None at rest. Every selected tile had its DEM.
- **Cause:** at each hole frame the list of drawn tiles had not changed for 1 to 14 frames, and visible tiles were covered by no drawn tile, more of them each frame. Each of those frames called `retainBaseCut` from `closeBaseQuadtreeCut`, never from `baseReplacementBlocked`: one coarse neighbour whose children were not ready made `refineQuadtreeCut` refuse the whole new list, and the list of the frame before was drawn again for a camera that had moved.
- **Not solved:** no fix tried.
- **Why two levels apart:** a second run counted the pairs of tiles two levels or more apart in each list `refineQuadtreeCut` refused. Mesh: 36 refusals of 405, 109 pairs. GPU: 43 of 276, 124 pairs. Every pair was two levels apart, and in every one the coarse tile asked to refine by its own screen space error, 13 to 31.7 for a threshold of 10, with none of its four children ready. The screen space error alone never gave the jump: the neighbouring branch was ready and refined, this one had not loaded. The same coarse tile, `6/32/21`, stayed with 0 of 4 children ready across the samples of the zoom. Why its children take so long was not measured.
- **How long the children wait:** a third run followed the children of each coarse tile a refusal waited for, through the load queue of 12 slots. 40 children on each engine became ready after 2 to 17 frames, 38 to 428 ms: 3 to 5 frames before they are even requested, their contents not yet known, then queued first or nearly at the priority of the balance, then about 4 frames of loading. That is the normal time of a load, not a stalled one, but the zoom creates a new jump before the last one is ready, so the list stays refused. Not explained: some running loads have priorities of 3e21 to 7e21.

#### T25. Displayable tiles: the refusal becomes local

- **Change:** a ready tile is displayable only within one level of its neighbours. When `refineQuadtreeCut` refuses an edge, only the new tiles involved, the fine one and those split for it, give their place back to what was displayed there; the rest of the list is published. The previous list is kept whole only when displayed tiles alone are involved.
- **Measured:** `mont-blanc` and `mont-blanc-zoom`, both engines, 6 s, two runs of the zoom. The whole list was never refused again, 0 of 283 to 474 closures. `mont-blanc` has no hole. A first run of `mont-blanc/mesh` drew nothing after a shader that failed to compile, and drew at 108.9 FPS without hole when run again.
- **Not solved:** holes while zooming, at a rate close to T24. Mesh: 6 and 13 frames, at worst 687 and 2 232 pixels, against 8 to 13 frames and 1 423 to 10 477 in T24. GPU: 19 and 23 frames, 8 754 and 6 793 pixels, against 12 to 29 frames and 6 381 to 24 152. Two runs do not separate the worst figures from the variation.
- **Cause of what remains:** the list now changes at every frame, but places enter the view whose tile is still loading. Their ready ancestor, for example `10/530/365` for `11/1061/730`, would be two levels coarser than a displayed neighbour, so it is not displayable, and nothing was displayed there the frame before. Such a place stays empty for 1 to 9 frames.

#### T26. Loading the periphery of the view

- **Change:** with a periphery, `frustumMargin` of `terrain-config.json` at 0.25 of the half extent of the view, the base selection loads the tiles of the periphery and their descendants down to the threshold, without selecting them. A waiting subtree now follows the priority of the frame, like contents.
- **Failed first:** periphery loads at the priority of the view, their screen space error. `mont-blanc-zoom`, three runs: mesh 11, 2 frames with holes, at worst 1 740 and 12 pixels; GPU 16, 24 and one more run, 7 141, 9 110 and 9 565 pixels. The tiles still missing were visible, their implicit subtree not loaded, for 8 frames or more.
- **Kept:** every load of the periphery comes after every load of the view, priority `-1 / (1 + error)`, with no tuned value. Two runs: mesh 8 and 9 frames, at worst 417 and 558 pixels; GPU 17 and 20 frames, 4 279 and 6 008 pixels. `mont-blanc` has no hole on either engine.
- **Not solved:** holes while zooming remain, a little smaller than in T25 at a similar rate. Two runs do not separate the difference from the variation. Not measured: the requests and the memory the periphery adds.

### WGSL, 2026-11-07

#### T27. WebGL from GLSL against WebGPU from WGSL

- **Change:** the GPU engine and the imagery drape of the mesh engine have WGSL twins of their GLSL shaders, which WebGPU runs, on the branch `feat/webgpu` of 3d-tiles-babylon. `npm run compare:renderers` draws the two bench views at rest with both, in headless Chrome, and compares the images pixel by pixel.
- **First failure:** WebGPU drew nothing, with "Destroyed texture used in a submit" at every frame, on `fix/selection` too. The example called `scene.render` in a promise, after the `endFrame` of `runRenderLoop`: the canvas texture was already presented. A first fix submitting with `flushFramebuffer` worked, but kept a frame drawn outside the engine and an internal call. Kept: the frame waits for the selection of its camera, then draws between `beginFrame` and `endFrame`.
- **Wrong reading:** the language check read `Material.shaderLanguage`, which says WGSL for every material on WebGPU. A first comparison of converted GLSL against WGSL on WebGPU gave 0 pixels on the GPU engine without proving which code ran. Read again on the compiled effects, it still gave 0 pixels on `mont-blanc`, GPU engine and draped mesh engine: the WGSL draws what Babylon draws from the GLSL on WebGPU. That reference used a temporary switch, removed.
- **Wrong reading:** the WebGL to WebGPU difference was first put on the shader compilers, FXC for ANGLE and DXC for Dawn. Dawn on Direct3D 11 (`--use-webgpu-adapter=d3d11`), compiling with FXC as ANGLE does, left it unchanged: 132 357 then 132 357 pixels on the mesh engine, 61 346 then 61 338 on the GPU engine.
- **Measured, `mont-blanc`:** two WebGL renderings are identical. Both APIs run on the same Intel Arc 140T, with 4 samples each. With multisampling, 61 346 pixels differ on the GPU engine and 132 357 on the mesh engine, whose shaders are those of Babylon. Without, 514 and 376: multisampling makes 99 % of the difference. SwiftShader for both was not possible: `--use-angle=swiftshader` removes WebGPU from the browser.
- **Result without multisampling, 905 760 pixels per image:**

| Case                | `mont-blanc` pixels | Largest R G B | `mont-blanc-zoom` pixels | Largest R G B |
| ------------------- | ------------------- | ------------- | ------------------------ | ------------- |
| mesh                | 376                 | 3 30 22       | 176                      | 1 1 1         |
| mesh, imagery       | 1 267               | 241 49 38     | 1 036                    | 8 8 8         |
| mesh, wireframe     | 46                  | 253 203 111   | 45                       | 202 119 224   |
| gpu, Mapzen normals | 514                 | 118 119 92    | 309                      | 1 1 1         |
| gpu, DEM normals    | 733                 | 110 111 85    | 530                      | 1 1 2         |
| gpu, imagery        | 1 417               | 50 28 18      | 1 147                    | 3 7 3         |
| gpu, ambient light  | 934                 | 41 28 18      | 827                      | 3 6 3         |
| gpu, wireframe      | 2 471               | 67 64 43      | 609                      | 35 31 27      |

- **Cause:** on shaded and draped cases, 93 to 100 % of the differing pixels differ by one level of 255, the rounding of the same operations translated twice, by ANGLE to HLSL for WebGL and by Tint for WebGPU. The ambient case, which lights nothing and only reads imagery, has as many: texture filtering shows it too. The rest, 1 to 61 pixels, lie on an edge or a texel boundary of the debug imagery, moved by a pixel. In wireframe, lines move by a pixel: 45 of 46 differing pixels take the colour of a neighbour on the mesh engine. The mechanism inside each translation was not isolated.
- **Legacy draped path of the GPU engine, forced for one run:** it compiles and draws in WGSL without validation error, 466 and 1 360 pixels differing on `mont-blanc`.

### Main after the merge, 2026-11-08

#### T28. Checking main after #32 of core and #18 of 3d-tiles-babylon

- **Failed, in the probe:** the first bench of `main` reported shared vertices 8 085 m apart on `mont-blanc/gpu` and 6 044 m on `mont-blanc-zoom/gpu`, 6 000 and 3 361 m at rest, with heights of -4 755 and -2 638 m at Mont Blanc. Since `b0e44ca` the GPU engine spreads its instances over one grid per junction topology, and `gpuSharedEdges` still read the elevation references of `terrain.grid`, the grid of one topology, at the index of each instance in `placed`. Read on the grid and index of each instance, all 113 instances of a view had valid references. Bisected first: `54690ab` gave 0 m, `b0e44ca` 8 324 m, without the periphery too, 8 016 m. The same figures were in the runs of T24 to T26, which did not report this column. Raw report: `T28-main-stale-probe.json`.
- **Failed, in the harness call:** `--query renderer=webgpu` stops the bench, which counts uploads through WebGL `bufferData`.
- **Kept:** the probe reads each instance on its own grid, at its own index.
- **Measured, one run, 8 s, with the Browser pane drawing the example at the same time on two paths:** 0 m between shared vertices on the four paths, in motion and at rest, and no hole at rest. Raw report: `T28-main.json`.

| Path                   | FPS  | Hole frames | Worst pixels | Edge m |
| ---------------------- | ---- | ----------- | ------------ | ------ |
| `mont-blanc/mesh`      | 100  | 0           | 0            | 0      |
| `mont-blanc/gpu`       | 89.2 | 2 of 239    | 14           | 0      |
| `mont-blanc-zoom/mesh` | 91.9 | 5 of 366    | 415          | 0      |
| `mont-blanc-zoom/gpu`  | 60.8 | 14 of 225   | 4 677        | 0      |

- **Renderers:** `npm run compare:renderers` gives the figures of T27 on the 16 cases, within 7 pixels in wireframe.
- **Places:** `place=yosemite`, 4 s on both engines in WebGL: 0 m, holes on 2 frames in motion, 31 and 82 pixels at worst. The Google example loads 274 tiles without error.
- **Not solved:** the holes while zooming of T24 to T26 remain, in their range. Frame rates are not compared with T26: the Browser pane drew the example during this run.
