# Raster draping

Rules shared by every implementation that drapes raster pyramids, such as satellite imagery, over terrain tiles. Terrain and imagery are two independent implicit quadtrees on the same Web Mercator pyramid, traversed by two runtimes on the same camera: terrain refines on geometric error, imagery on texel size, so a flat area can show a coarse mesh with fine imagery.

## Two engines

A renderer binds the pages of one pyramid to the tiles of the other. Two engines are specified; they share the page pyramid, the residency index and the GPU page pool, and differ in their render unit.

| Engine         | Render unit                                         | Bound pages                                                                | Geometry                                        |
| -------------- | --------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| Mesh draping   | terrain tile                                        | `4^k` imagery pages, one per cell, `k` set per tile by the imagery cut     | CPU meshes, as built today                      |
| GPU instancing | leaf of the instance cut, the finer of the two cuts | one imagery page, and the elevation page of the terrain tile containing it | one shared grid instanced, displaced on the GPU |

Both engines remain available behind the same runtimes, pages and residency index; a renderer selects one.

## Imagery tree

- Imagery tiles use the same addressing as terrain tiles, with their own `minLOD` and `maxLOD`.
- The geometric error of an imagery tile is the ground size of one texel at the equator, `groundResolution(0, lod)`, so that the screen-space error is the size of one texel in pixels.
- An imagery tile has no height of its own. Its bounding volume uses the height range prepared for the terrain tile at the same address, or for its deepest ancestor with a prepared range.

## Pages

- A page is the stitched raster of one imagery tile: `(w + 1) x (h + 1)` texels in `point` registration, following [Rasters](raster.md#stitching), whatever the registration of the source. Neighbouring pages then hold the same texels on their shared edge, and bilinear filtering shows no seam. Imagery and terrain stay in place at any pair of levels, since both lie on the corners of their pixels: a model placed in absolute coordinates lands where it should on both.
- When a neighbour arrives, the pages it completes are uploaded again.
- A texel in point registration `t` in `[0, 1]` maps to the texture coordinate `(t * (size - 1) + 0.5) / size`, the centre of the texel.

## Residency and covers

The pages available to the renderer form a residency index. The cover of a tile is the deepest resident page containing it, with the area the tile occupies in that page: `west`, `north` and `size`, as for [tile pyramids](tiles.md#tile-pyramids). A binding therefore falls back to a coarser page while a finer one loads.

## Mesh draping

- The imagery cut is the set of imagery tiles its runtime presents. Its runtime refines on texel size, so the cut follows the camera distance.
- The drape depth `k` of a terrain tile at level `g` is the number of levels between the tile and the deepest tile of the cut inside it, clamped to `[0, maxDepth]`: `0` for a distant tile whose imagery is as coarse as the terrain or coarser, more for near tiles.
- The terrain tile is divided into `2^k x 2^k` cells, the tiles of level `g + k` inside it, row-major from the north-west cell. Each cell uses its cover among the resident pages of level `g + k` or coarser: its own page, or the page of a coarser tile. A cell without any cover keeps the base colour of the terrain.
- Cell `(i, j)` of a fragment at tile coordinates `(u, v)` is `(floor(u * 2^k), floor(v * 2^k))`, clamped to `[0, 2^k - 1]`; its cell coordinates are `(u * 2^k - i, v * 2^k - j)`. The page coordinates are `(west + s * size, north + t * size)`.
- Each terrain tile owns a table of `2^maxDepth x 2^maxDepth` entries, of which the first `2^k x 2^k` hold, per cell, the page and the area `west, north, size` of the cell in it.
- A drape depth increases as soon as the cut refines, and decreases only after the cut has stayed coarser for a hold time, 500 ms by default: the cut passes through transient states while imagery tiles are replaced, and coarsens for a moment while the camera turns. The finer pages stay resident meanwhile.
- The binding of a terrain tile changes when the cut changes, or a page overlapping it at most `maxDepth` levels finer becomes resident or leaves.

## GPU instancing

The mesh draping engine builds a mesh per terrain tile on the CPU: DEM sampling, junctions, normals and drape tables. The GPU instancing engine leaves the CPU only the cut, a few values per instance and the uploads of new pages; one draw call renders the terrain.

### Instance cut

- The instances are the leaves of the union of the terrain cut and the imagery cut. Inside each presented terrain tile, the imagery tiles of the cut below it are instances, completed with the tiles needed to cover the terrain tile without overlap; a terrain tile without finer imagery is one instance. An instance is never coarser than its terrain tile.
- A level below a terrain tile stays in the instance cut for a hold time after the imagery cut stopped reaching it, 500 ms by default, for the reason given for the drape depth.
- The leaves are balanced across edges: a leaf whose edge neighbour is subdivided two levels deeper or more is split into its four children, until every edge joins leaves at most one level apart. Columns wrap around the antimeridian. Corners are not balanced: corner vertices exist at every level.
- Neighbours follow the topology of the pyramid. On the [cube index](celestial-tiling.md#neighbours-across-faces), the tiles across a face edge are read in their own turned frame, and at the 8 vertices of the cube a corner touches 3 tiles instead of 4. Reading the DEM of a tile on another face turns the coordinates of the instance: the area of an instance in a tile holds `west`, `north`, `size` and the quarter turns, and only the points the two tiles share lie inside it.
- Each instance knows, for each edge, whether the instances across it are one level coarser, one level finer or of its level, and, for each edge and each corner, the terrain tile whose DEM gives the heights there: the coarsest terrain tile among the instances touching that edge or corner, its own on ties.

### Geometry

- Every instance draws the same predefined grid, as in SpaceXR: the normalized topology of [terrain grids](grid.md) of `n x n` cells over `u` west to east and `v` north to south, whose four edges are refined with a vertex in the middle of each cell side, the `Finer` variant on every edge. One mesh is instanced once per instance, so the terrain costs one draw call. Instances only carry the values that size and place the grid; positions and heights come from buffers.
- Neighbouring instances join without cracks and without skirts:
  - an instance of the same level has the same edge vertices;
  - a coarser neighbour's edge has its corners and its edge midpoints at the vertices of the finer instance's edge;
  - a finer neighbour's edge vertices lie at the vertices and the edge midpoints of the coarser instance's edge.
- The height of an edge vertex is read from the DEM of its edge, or of its corner, given by the instance cut, so both sides of an edge read the same heights. An edge midpoint reads its height there when the instances across the edge are finer, since it is one of their vertices. Otherwise it lies at the middle of the segment between its two neighbours on the edge, which is the segment the coarser or same-level instance across draws.
- In Web Mercator, every tile of level `l` and row `y` is the tile of column 0 rotated about the polar axis. The shape of `(l, y)` holds, per point of the half-cell lattice, the vertices of the grid and the edge midpoints, the position on the ellipsoid relative to the centre of the tile, in a frame rotated so that the centre longitude is 0, and the geodetic latitude. Shapes are computed in double precision once per `(l, y)` and stored as 32-bit floats, which only hold distances within a tile.
- A vertex at height `h`, the DEM height times the vertical scale, is at `R(lambda_c) (s + h * n) + (c - e)`: `s` its shape position, `n` the ellipsoid normal at its latitude and at the longitude `(u - 0.5) * 360 / 2^l` degrees, `R(lambda_c)` the rotation by the longitude of the tile centre, `c` the ECEF position of the tile centre and `e` the camera position. The CPU computes `c - e` in double precision every frame, so that no float holds Earth-scale coordinates.
- The normal of a vertex is the cross product of the central differences of the displaced positions of its neighbours in the grid, one-sided on the edges. Neighbours on an edge take their heights like edge vertices. On a slope, the one-sided differences of two tiles differ, which shows as a crease along their edge, and relief smaller than a cell is lost.
- With radial heights, the normal is computed at each pixel instead: the gradient of the DEM page of the instance, central differences at its samples interpolated bilinearly, added along the ray to the tangents of the reference surface. Tangents are projected on the tangent plane, known exactly from the radii, which removes the lean of one-sided chords on tile edges.
- The geometric error of a terrain tile follows the cells of its grid, not the samples of its DEM: with 16 cells per tile, a tile assumed to hold 256 would look 16 times more precise than it is, and craters smaller than a cell would come out as facets.

### Elevation pages

- The elevation of an instance is the DEM tile serving its terrain tile, at the source level or a generated one, and the area of the instance in that tile. A vertex samples its page at `(west + u * size, north + v * size)`.
- A page is the stitched height grid of a DEM tile, `(w + 1) x (h + 1)` 32-bit float heights in point registration, read without filtering and interpolated bilinearly in the shader. Half floats would halve the memory, with heights stored relative to the minimum of their tile: their spacing reaches 4 m between 4096 and 8192 m.
- A page is resident while a presented terrain tile uses it, and written again when a neighbour completes its stitched edges.

### Imagery

- Each instance samples one imagery page: the cover of its tile among the resident imagery pages, its own page or a coarser one while its own loads. An instance without any cover keeps the base colour of the terrain.
