# Terrain grids

Rules shared by every implementation of the terrain grid layer (`@spacexr/grid` for Node.js, future .NET and C++ equivalents). The layer is independent of 3D Tiles and of any renderer: it produces normalized triangle topologies that adapters project onto regions, ellipsoids or planes, on the CPU or in a vertex shader. A grid covers one tile of a quadtree pyramid, so it uses the tile definitions of [Web tiles](tiles.md): levels of detail, XYZ axes and the `NW, N, NE, W, C, E, SW, S, SE` neighbour layout.

## Normalized coordinates

- A grid has `columns` segments along `u` and `rows` segments along `v`.
- `u` runs west to east and `v` north to south, both in `[0, 1]`, like the tile `x` and `y` axes. Coordinates carry no Cartesian position, so one topology serves every tile of the same size.
- Every vertex lies on the half-cell lattice `u = U / (2 * columns)`, `v = V / (2 * rows)`, with integer `U` and `V`. Edge midpoints use odd lattice values; all other vertices use even ones.
- Vertices are ordered by `V`, then by `U`. Indices list three vertices per triangle.
- Triangles are counter-clockwise when seen from above with east to the right and north up: in `u, v` axes their signed area `(b - a) x (c - a)` is negative.

## Regular grid

A regular grid splits every cell along an alternating diagonal, as the SpaceXR terrain grid does. With `column` and `row` counted from the north-west cell:

- when `column + row` is even, the cell is split from north-west to south-east into `(north-west, south-east, south-west)` and `(north-west, north-east, south-east)`;
- otherwise from north-east to south-west into `(north-west, north-east, south-west)` and `(south-west, north-east, south-east)`.

Diagonals therefore only join vertices whose `column + row` is even. Away from the edges these vertices carry eight triangles and the others four, a regular pattern required by shaders that rely on per-vertex weights. Implementations must keep this parity.

## Junctions between levels of detail

Neighbouring quadtree tiles may differ by one level. On their shared edge the finer tile has twice as many vertices as the coarser one, and the extra vertices leave cracks or T-junctions in the terrain:

![Coarse tile (blue) next to a finer tile (green): the edge vertices of the finer tile do not exist on the coarse tile](images/grid-lod-connections.png)

Each edge neighbour `N`, `E`, `S` and `W` receives its level relative to the tile, `neighbour lod - tile lod`. A difference beyond one level is an error: the tile selection must keep neighbours balanced. An edge without a displayed neighbour, for example beyond the pyramid, uses `Same`.

| Level     | Value | Edge vertices                                                             |
| --------- | ----- | ------------------------------------------------------------------------- |
| `Coarser` | `-1`  | every other vertex: `segments / 2 + 1`; `columns` and `rows` must be even |
| `Same`    | `0`   | every vertex: `segments + 1`                                              |
| `Finer`   | `+1`  | every vertex and every segment midpoint: `2 * segments + 1`               |

Exactly one tile of a junction adapts:

- with the coarse tile adapting, it uses `Finer` on the shared edge and the finer tiles use `Same`. The new midpoints must receive the heights of the finer tiles, for example by sampling the same elevation source;
- with the fine tile adapting, it uses `Coarser` and the coarse tile uses `Same`. The fine tile edge becomes straight between the shared vertices and needs no extra height.

Corner vertices exist at every level, so the corner neighbours `NW`, `NE`, `SE` and `SW` never create a crack. Only the four edge neighbours matter.

### Triangulation

A junction grid starts from the regular grid and adapts each edge in the order `N`, `E`, `S`, `W`. Every edge segment belongs to exactly one triangle, whose third vertex is an inner vertex:

- `Finer` replaces the triangle `(a, b, inner)` of each segment `a, b` by `(a, m, inner)` and `(m, b, inner)`, where `m` is the midpoint of the segment;
- `Coarser` merges, for each odd edge vertex `m` between `a` and `b`, the triangles `(a, m, inner)` and `(m, b, inner)` into `(a, b, inner)`. With the alternating diagonals and even `columns` and `rows`, odd edge vertices carry no diagonal, so both triangles share the same inner vertex.

Every triangle is then oriented counter-clockwise. The rest of the grid keeps its alternating diagonals.

### Single grid and split pieces

![Single grid and split pieces for N +1, E -1, S 0 and W +1](images/grid-junction-variants.svg)

- **Single grid**: one topology and one draw call per tile. There are 81 variants for the combinations of the four edge levels, identified by `(N + 1) + 3 (E + 1) + 9 (S + 1) + 27 (W + 1)`.
- **Split pieces**: the same triangles in nine pieces, placed and numbered like the neighbour layout. A triangle touching a tile corner belongs to the corner piece of that corner, `NW`, `NE`, `SE` or `SW`; otherwise a triangle touching an edge belongs to the band of that edge, checked in the order `N`, `E`, `S`, `W`; every other triangle belongs to the interior `C`. The interior never changes, each edge band has 3 variants and each corner piece 9, one per pair of levels of its two edges. Changing a neighbour swaps one band and two corners, and pieces can be instanced across tiles, at the cost of nine draw calls per tile.

Split pieces require even `columns` and `rows` of at least 4, so that no triangle touches two edges away from a corner. The pieces of any combination cover exactly the triangles of the single grid for the same combination.

## Tile geometry

A surface places the tiles of a pyramid on a body, whatever its projection: a tile coordinate and a height give a body-fixed position, and the surface gives the direction heights move a point along. Web Mercator surfaces use geodetic heights along the normal of the ellipsoid; [cube surfaces](celestial-tiling.md#terrain-heights) use radial heights.

- A grid placed on a tile holds the centre of the tile on the reference surface, in double precision, and the vertices relative to it, along the body-fixed axes. Distances within a tile keep 32-bit floats precise.
- Parameters are recovered from the half-cell lattice in double precision, so both sides of a shared edge compute the same points, across cube faces included.
- Triangles keep their winding: counter-clockwise seen from outside the body, on every face.
- A shape is a regular lattice of `(cells + 1)^2` vertices on the reference surface, rows from north to south, which a renderer uploads once and displaces on the GPU. A point of a tile is `center + Rz(rotation) * position`. Tiles of one Web Mercator level and row share a shape, turned by the longitude of their centre. Each cube tile has its own: the same address on another face is never in view with it.

## Vertex placement

The vertex builder, ported from the SpaceXR `TerrainNormalizedGridBuilder`, places a topology in a local frame centred on the grid:

- `x = (-0.5 + offsetColumns / columns + u) * scaleX`;
- `y = (0.5 + offsetRows / rows - v) * scaleY`, so Y grows northward;
- `z = zInitializer(vertex)`, or 0, where `vertex` gives `u`, `v`, `column = u * columns`, `row = v * rows`, `columns` and `rows`. As in SpaceXR, `column` and `row` are half-integers on edge midpoints;
- `invertYZ` stores `x, z, y` for Y-up engines, and normals become `(0, 1, 0)` instead of `(0, 0, 1)`;
- texture coordinates are `uvInitializer(vertex)`, or `u, v` by default;
- `invertIndices` reverses the winding. Mirroring with a negative scale or swapping axes changes the handedness, which the caller compensates with `invertIndices`.
