# Digital elevation models

Rules shared by every implementation of the DEM layer (`@spacexr/dem` for Node.js, future .NET and C++ equivalents). A height grid is a [raster](raster.md) of one 32-bit floating-point channel, in metres, so sampling, ranges, stitching and pyramids follow the raster rules.

## Encodings

| Encoding             | Formula                                    |
| -------------------- | ------------------------------------------ |
| `terrarium`          | `r * 256 + g + b / 256 - 32768`            |
| `mapbox-terrain-rgb` | `-10000 + (r * 65536 + g * 256 + b) * 0.1` |
| `grayscale`          | `minimum + r / 255 * (maximum - minimum)`  |

- Pixels must be read without colour conversion and without alpha premultiplication.
- A pixel whose alpha is 0 is missing by default and stored as `NaN`.
- The minimum and maximum of a height grid ignore missing samples and are `NaN` when every sample is missing.

## Terrarium encoding

- A valid height h in metres becomes the integer q = round((h + 32768) * 256). Round ties toward the higher height. Split the whole integer into R = floor(q / 65536), G = floor(q / 256) mod 256, B = q mod 256, and A = 255. Rounding the integer before splitting preserves channel carries.
- The inclusive input range is [-32768, 32767.99609375] metres. Reject infinities and values outside that interval; do not silently saturate. The quantization step is 1/256 metre and the maximum rounding error is 1/512 metre.
- NaN encodes to [0, 0, 0, 0]. The lowest valid height encodes to [0, 0, 0, 255], so it remains distinct from missing data.
- Preserve row-major north-west sample order, grid dimensions and source heights. Encoding does not resample or create shared borders. A caller-supplied destination is exact-sized, non-overlapping and remains unchanged if validation fails.
- Encoded pixels are raw RGBA. A separate lossless image encoder must preserve their bytes, colour interpretation and unpremultiplied alpha. The elevation codec does not perform image compression.

## Cube tiles

The tiles of the [cube index](celestial-tiling.md#terrain-heights) hold radial heights and their shared edges, `(tileSize + 1)^2` samples.

- A dataset of a tile service gives the surface of its heights and the tiles it declares. A tile outside its declared availability is never requested.
- A tile the dataset does not declare, or below its deepest level, interpolates its parent bilinearly, down to the deepest level of the terrain.
- The normal of a displaced surface on any tile is the cross product of the differences of the positions of its neighbouring points, `east - west` and `north - south`, one-sided where a height is missing, as on the edge of a cube face.
- A tile service converts a source with heights along the normal of an ellipsoid by searching the point of the relief on the ray: the geodetic position of a point of the ray gives the height of the relief, whose radial height gives the next point.

## Statistics and normals

- `lowest` and `highest` locate the extreme valid samples by column and row; `mean` and `delta = maximum - minimum` ignore missing samples and are `NaN` when every sample is missing.
- The ranges of the four quadrants, the extents of the child tiles, follow the raster range rule over each half.
- A view copies a rectangle of the grid, and of its normals, and recomputes the statistics.
- Normals are unit vectors in local east, north, up axes, computed with central differences: `n = normalize(-dh/de, -dh/dn, 1)`. Rows grow southward, so `dh/dn` is the negated row gradient. Edges and samples next to missing values use one-sided differences; a sample without valid neighbours gets `(0, 0, 1)`.
- For Web Mercator tiles, the sample spacing is the ground resolution at the tile centre latitude multiplied by `tileSize / gridWidth`, identical along rows and columns because the projection is conformal.

## DEM pyramids

A DEM pyramid is a raster pyramid of height grids, sampled as one continuous surface.

- Below the deepest DEM level, levels can be generated down to the deepest level of the terrain tile system, as described in [Generated levels](raster.md#generated-levels): `cubic` interpolation smooths terrain the DEM cannot resolve, instead of the facets of an overzoomed bilinear sub-area.
- Heights and gradients at a point read the DEM tiles in memory only. A renderer retains the DEM tiles of the terrain it displays, so that the cache never evicts the data their shared edges are computed from.
- The heights of a tile come with the range of every sample it can interpolate and with the ranges of its four quadrants, which can bound its children before their own DEM is loaded.
- A point touched by tiles of several levels of detail, on the edge between a tile and a coarser or finer neighbour, takes its height from the levels chosen by a policy: `coarsest` keeps the coarse tiles intact, `finest` keeps the finest detail, `average` takes the mean over every level. Missing levels are left out.
- The gradient at a point differentiates the heights of each level one grid cell apart, `1 / (cells * 2^lod)` in pyramid units for grids of `cells` cells per tile, so that shading follows the mesh rather than DEM detail its triangles cannot show; a missing neighbour falls back to a one-sided difference. The gradient over several levels is the mean of their gradients.
- On a Web Mercator pyramid, one pyramid unit spans `2 * pi * a * cos(lat)` metres, where `a` is the semi-major axis of the ellipsoid. With east `e`, north `n` and up `u` at the point, the surface normal is `normalize(u - (gx / m) * e + (gy / m) * n)` for a gradient `(gx, gy)` along `x` eastward and `y` southward and `m` that span, heights multiplied first by any vertical scale. At the poles the normal is `u`.

## Worker decoding protocol

Implementations that decode DEM tiles in workers exchange two messages:

- request `{ id, bytes, encoding, transparentAsNoData? }`, with the buffer of `bytes` transferred;
- response `{ id, width, height, data }`, with the buffer of `data`, the heights, transferred, or `{ id, error }`.

`id` is unique per pending request. A client that abandons a request ignores its response.

## Presets

| Preset           | URL                                                                       | Levels  | Tile size | Encoding    |
| ---------------- | ------------------------------------------------------------------------- | ------- | --------- | ----------- |
| Mapzen Terrarium | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | 0 to 15 | 256       | `terrarium` |

Mapzen Terrain Tiles require attribution of their data sources, listed at https://github.com/tilezen/joerd/blob/master/docs/attribution.md.
