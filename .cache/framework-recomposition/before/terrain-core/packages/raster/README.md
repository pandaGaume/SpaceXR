<img src="https://raw.githubusercontent.com/pandaGaume/3d-tiles-core/main/assets/brand/spacexr-component.png" alt="SpaceXR Component" height="56">

# @spacexr/raster

Renderer-neutral tile rasters: grids of values attached to web tiles, whatever they mean. Heights, colours, masks and normals share the same layout, bilinear sampling, image decoding, seamless stitching of neighbouring tiles and on-demand pyramids. Tiles, neighbours and pyramids are those of [`@spacexr/tiles`](https://github.com/pandaGaume/3d-tiles-core/tree/main/node/packages/tiles); [`@spacexr/dem`](https://github.com/pandaGaume/3d-tiles-core/tree/main/node/packages/dem) builds elevation models on this package.

## Install

```bash
npm install @spacexr/raster
```

## Rasters

```ts
import { createRasterGrid, rasterRangeInArea, sampleRasterBilinear } from "@spacexr/raster";

// width x height samples, row-major from the north-west corner, channels interleaved.
const colours = createRasterGrid(256, 256, 4, pixels); // Uint8ClampedArray
const green = sampleRasterBilinear(colours, 0.5, 0.25, 1); // u east, v south, channel 1
const range = rasterRangeInArea(colours, 0, 0, 0.5, 0.5, "area", 1);
```

`sampleRasterBilinear` and `rasterRangeInArea` take an `area` registration, for tiles as published, or a `point` registration, for stitched rasters whose first and last samples lie on the tile edges. Missing floating-point values are `NaN` and are left out of the interpolation.

## Seamless pyramids

The last pixels of a published tile lie half a pixel inside it, so two neighbouring tiles never share a sample: interpolated heights crack and interpolated colours show a seam. `StitchedRasterGrids` gives every tile `(w + 1) x (h + 1)` samples on the corners of its pixels, each the mean of the four pixels around it, whatever the arrival order. `RasterPyramid` loads the eight neighbours of every tile and stitches them:

```ts
import { BrowserImageDecoder, RasterPyramid } from "@spacexr/raster";

const images = new BrowserImageDecoder();
const imagery = new RasterPyramid({
    registration: source.registration,
    load: async (address) => {
        const result = await source.fetchTile(address);
        return result.status === "absent" ? undefined : images.decode(result.bytes);
    },
    maxLOD: 19,
    wrapX: true,
});

const region = await imagery.load({ lod: 21, x: 1200000, y: 800000 }); // overzoomed from level 19
const red = region?.sample(1, 0.5, 0); // identical on the west edge of the east neighbour
const value = imagery.sampleAt(0.5, 0.25, 19, 0); // point of the pyramid, x east and y south in [0, 1]
```

Pass `create` to build another grid type from each stitched raster, as `@spacexr/dem` does to compute height ranges.

## Declaring the registration

`registration` is required, with no default, where data is imported: on `WebTileSource`, `RasterPyramid`, `DemPyramid`, `StitchedRasterGrids` and `ISourceTileMatrix`. It belongs to the data, so read it from the source or measure it: a wrong declaration moves the surface half a pixel without any other sign. Leaving it out does not compile, and a missing or unknown value throws a `TypeError` for callers the compiler does not reach, when the object is built, or when a matrix is first read. The rule and the registration of each kind of source are in [docs/raster.md](../../../docs/raster.md#stitching).

`prestitched` is deprecated. It no longer decides anything: it does not replace `registration`, and a value that disagrees with it throws a `TypeError`. Remove it when you declare the registration:

| Before                          | Now                     | Effect                                                                                                                  |
| ------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `prestitched: true`             | `registration: "point"` | none                                                                                                                    |
| `prestitched: false`, or absent | `registration: "area"`  | the surface moves half a pixel to its true place, is smoothed by half a pixel, and each tile loads its eight neighbours |

A source that exposes its registration, such as `WebTileSource` or a DEM preset, passes it on: `registration: source.registration`.

## Draping

`drapeCells` and `drapeDepth` drape a terrain tile with `4^k` raster pages, one per cell, for the mesh draping engine. `DrapeInstanceCut` computes the instances of the GPU instancing engine: the finer of the terrain and imagery cuts at each place, balanced so that edges join instances at most one level apart, with the level of the neighbours across each edge and the terrain tile whose DEM gives the heights of each edge and corner, so that instances join without cracks. See [Raster draping](https://github.com/pandaGaume/3d-tiles-core/blob/main/docs/draping.md).

```ts
const cut = new DrapeInstanceCut({ holdMilliseconds: 500 });
const instances = cut.update(terrainCut, imageryCut, performance.now());
// Compute again at cut.expiresAt, when a level held after the imagery coarsened leaves the cut.
```

## Image decoding

`IImageDecoder` turns PNG, WebP or JPEG bytes into an `IRgbaImage`, a raster of four 8-bit channels. `BrowserImageDecoder` uses `createImageBitmap` and `OffscreenCanvas`, which are available in workers, and disables colour conversion and alpha premultiplication, which would otherwise alter values encoded in the pixels. On Node.js, supply an image decoder based on a PNG library.

See the repository document `docs/raster.md` for the cross-language rules.

## License

Apache-2.0.
