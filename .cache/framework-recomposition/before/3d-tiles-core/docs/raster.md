# Rasters

Rules shared by every implementation of the raster layer (`@spacexr/raster` for Node.js, future .NET and C++ equivalents). A raster is a regular grid of values attached to a tile: heights, colours, masks or normals. The rules below do not depend on what the values mean, so imagery and elevation share them.

## Layout

- A raster has `width x height` samples, row-major from the north-west corner, with `channels` interleaved values per sample: channel `c` of sample `(column, row)` is at index `(row * width + column) * channels + c`.
- Values are stored in a typed array: 32-bit floats for heights, 8-bit unsigned integers for colours. A missing floating-point value is `NaN`.
- A decoded image is a raster of four 8-bit channels, R, G, B and A. Image decoders must return the stored pixel values without colour space conversion and without alpha premultiplication, otherwise values encoded in the pixels, such as elevations, are corrupted.

## Sampling

A raster is sampled in normalized tile coordinates, `u` west to east and `v` north to south, with one of two registrations:

| Registration | Sample `i` of `size` lies at | Use                                                            |
| ------------ | ---------------------------- | -------------------------------------------------------------- |
| `area`       | `(i + 0.5) / size`           | a tile as published: each sample covers one pixel              |
| `point`      | `i / (size - 1)`             | a stitched raster: the first and last samples lie on the edges |

- Bilinear sampling reads one channel. It clamps the sample coordinate to `[0, size - 1]` and leaves missing samples out of the weighting; the result is `NaN` only when the four samples are missing.
- In `area` registration the last pixels lie half a pixel inside the tile, so two neighbouring tiles never share a sample. Interpolated heights show a crack and interpolated colours a seam along their shared edge.

The range of a channel over an area covers every sample a bilinear sample inside it can interpolate: columns `floor(west * size - 0.5)` to `ceil(east * size - 0.5)` in `area` registration, `floor(west * (size - 1))` to `ceil(east * (size - 1))` in `point` registration, and likewise for rows. Both bounds are `NaN` when no valid sample is covered.

## Stitching

The registration belongs to the data: **every source declares it where its data is imported**, and it is required, with no default. It is measured or read from the source, not assumed. A source without a registration, or with an unknown one, is rejected instead of being read as either: a wrong registration moves the surface half a pixel without any other sign.

An implementation may keep an older option that said whether tiles hold their shared edges, such as `prestitched`, only as a deprecated one: `true` is `point` and `false` is `area`. It never replaces the registration, and a value that disagrees with it is rejected.

| Source                                         | Registration | How it is known                                                                                          |
| ---------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| Web tiles, WMTS, XYZ                           | `area`       | [OGC 2D Tile Matrix Set](https://docs.ogc.org/is/17-083r4/17-083r4.html): a cell lies between grid lines |
| Mapzen Terrarium                               | `area`       | its production code and the agreement between consecutive levels                                         |
| Tiles of the [cube index](celestial-tiling.md) | `point`      | specified: `(w + 1) x (h + 1)` samples                                                                   |
| GeoTIFF                                        | either       | `GTRasterTypeGeoKey` of each file, `PixelIsArea` by default                                              |

A stitched raster holds `(w + 1) x (h + 1)` samples in `point` registration, with the same channels and array type. How a tile gets there follows its registration.

**`area`**: the samples move to the corners of the pixels, where they lie on the tile edges.

- Each stitched sample is the mean of the four pixels around its corner. The surface stays where the source placed it, smoothed by half a pixel.
- Near an edge, those pixels come from the eight neighbours at the same level of detail. Until a neighbour is available its pixels are left out, like missing values. Where no neighbour exists, at the top of a pyramid, the mean of the remaining pixels stands.
- Adding a tile also updates the corners it touches in the tiles already present, so the result does not depend on the arrival order.
- Values of integer rasters are rounded.

Copying pixels into a `point` grid unchanged is not allowed: it moves the surface half a pixel to the north-west, which doubles at each coarser level, 1.46 m at level 15 and 46.9 m at level 10 at a latitude of 52 degrees.

**`point`**: tiles already hold their shared edges and are used as they are. Nothing is taken from the neighbours, which may lie on another face, in a turned frame.

In both cases neighbours must have the same size and number of channels, and neighbouring stitched rasters hold identical samples on their shared edge. A grid of `w` cells sampled in `point` registration places each vertex exactly on a sample.

## Generated levels

A raster pyramid can generate the levels below the deepest level of its source, typically down to the deepest level of the tile system the rasters are draped on. Each generated tile interpolates the level above, generation by generation.

- The tiles of one level form a single lattice: sample `i` of tile `x` lies at `x + i / w` in tile units, `w` samples per tile, and likewise for rows. Generated tiles hold samples of this lattice. They are completed by the first column of their east neighbour, the first row of their south neighbour and the first sample of their south-east neighbour.
- The first generated level starts from the corners of the pixels of a source in `area` registration: each lattice sample of its parents is the mean of the four pixels around it, as when stitching.
- Sample `i` of the child at column `c` (0 west, 1 east) of a parent lies at parent sample `(c * w + i) / 2`, and likewise for rows. Its value interpolates the lattice of the parent level at that position, using the parent and its eight neighbours; a missing neighbour repeats the edge samples of the parent.
- A child of a raster in `point` registration interpolates its parent alone, bilinearly at `(c * w + i) / 2`: samples of an edge only read the same edge of the parent, so neighbouring children keep identical edges.
- Children of neighbouring parents interpolate the same lattice, so generated tiles share their edges.
- Missing samples are left out of the weighting.

| Interpolation | Samples | Properties                                                                                      |
| ------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `nearest`     | 1       | sample `round(x), round(y)`                                                                     |
| `linear`      | 3       | linear on the two triangles of each cell, split from its north-west to its south-east corner    |
| `bilinear`    | 4       | bilinear in each cell                                                                           |
| `cubic`       | 4 x 4   | Catmull-Rom spline: smooth (C1), interpolating, may overshoot; bilinear next to missing samples |

Catmull-Rom weights for `t = x - floor(x)` are `(-t^3 + 2t^2 - t) / 2`, `(3t^3 - 5t^2 + 2) / 2`, `(-3t^3 + 4t^2 + t) / 2` and `(t^3 - t^2) / 2`. Every interpolation passes through the samples of the lattice, so generated levels keep the heights of the stitched source, without smoothing them further, and reproduces constant values; all but `nearest` reproduce linear slopes. Approximating schemes such as a quadratic B-spline are excluded: applied generation after generation, they lower summits at each level, by 14 m from a 4808 m summit sampled every 30 m in one generation.

## Raster pyramids

A raster pyramid is a [tile pyramid](tiles.md#tile-pyramids) of rasters, whose source declares its registration. It stitches each raster as it arrives, and prefetches what that needs: the eight neighbours of a source tile in `area` registration, the `E`, `S` and `SE` neighbours of a generated tile, nothing in `point` registration.

- A tile at any level samples the stitched raster of the tile serving it, its ancestor at `maxLOD` beyond that level, in `point` registration over the area it covers.
- A point of the pyramid is addressed by `x` eastward and `y` southward in `[0, 1]`. At level `l` it lies in tile `(l, floor(x * 2^l), floor(y * 2^l))`; a point on a tile edge may be read from either side, which return the same value. The value is `NaN` while no raster containing the point is loaded.
- Columns wrap around the antimeridian only when requested.
