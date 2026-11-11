<img src="https://raw.githubusercontent.com/pandaGaume/3d-tiles-core/main/assets/brand/spacexr-component.png" alt="SpaceXR Component" height="56">

# @spacexr/dem

Renderer-neutral digital elevation models. A height grid is a one-channel raster of [`@spacexr/raster`](https://github.com/pandaGaume/3d-tiles-core/tree/main/node/packages/raster), so DEM tiles are sampled, stitched and cached like any other raster; this package adds the elevation encodings, decoding off the rendering thread, statistics, normals, the Mapzen Terrarium preset and continuous surfaces over several levels of detail.

## Install

```bash
npm install @spacexr/dem
```

## Load a Mapzen Terrarium elevation tile

```ts
import { WorkerDemDecoder, createMapzenTerrariumSource, loadDemTile } from "@spacexr/dem";

const dem = createMapzenTerrariumSource();
const decoder = new WorkerDemDecoder([new Worker(new URL("./dem-decoder.worker.ts", import.meta.url), { type: "module" })]);
const tile = await loadDemTile(dem, { lod: 12, x: 1205, y: 1402 }, decoder, { normals: true, signal });

if (tile?.content) {
    const { minimum, maximum, mean, highest, quadrants } = tile.content;
    const northWest = tile.content.view(0, 0, 128, 128);
}
```

`loadDemTile` returns `undefined` when the tile does not exist. `DemInfos` statistics ignore missing samples. Display `dem.source.attribution` with the data.

## Encode Terrarium elevation pixels

```ts
import { createHeightGrid, encodeTerrariumGrid, terrariumPixel } from "@spacexr/dem";

const pixel = terrariumPixel(12.5); // [128, 12, 128, 255]
const heights = createHeightGrid(2, 1, new Float32Array([12.5, NaN]));
const pixels = encodeTerrariumGrid(heights);
```

Terrarium stores metre heights in RGB with a step of 1/256 metre and a maximum rounding error of 1/512 metre. Supported finite heights are -32768 to 32767.99609375 metres inclusive. NaN becomes a transparent NoData pixel; other invalid or out-of-range values throw. The minimum valid height is opaque and is distinct from NoData.

encodeTerrariumGrid accepts one Float32 or Float64 channel and returns raw unpremultiplied RGBA pixels with the same dimensions and sample order. An optional Uint8Array or Uint8ClampedArray destination avoids allocating the output buffer. Invalid input is detected before writing that destination. Source and destination storage must not overlap.

The output is not a PNG byte stream. Store it with a lossless image encoder that preserves channel bytes and does not apply colour conversion or alpha premultiplication. Grid dimensions are unrestricted, including 257 by 257 vertex samples; the caller defines the sampling positions and shared borders.

## Tiles of a celestial body

`cubeDemPyramid` reads an elevation dataset of a tile service on the [cube index](https://github.com/pandaGaume/3d-tiles-core/blob/main/docs/celestial-tiling.md): radial heights, one surface per face, poles included. The depth of a dataset may vary from place to place, with its subtrees: a tile deeper than the data at its place reads a sub-area of the deepest tile there. With `maxLOD`, tiles are generated bilinearly instead, and a slope read on them shows as a checkerboard in lighting.

```ts
import { cubeDemPyramid, tileSurfaceNormal } from "@spacexr/dem";
import { CelestialTileSource } from "@spacexr/tiles";

const source = new CelestialTileSource(await (await fetch("https://tiles.example.com/moon/lola.json")).json());
const pyramid = cubeDemPyramid(source, decoder);
const heights = await pyramid.tileHeights({ face: 5, lod: 11, x: 1024, y: 1023 });
const normal = tileSurfaceNormal(source.surface, { face: 5, lod: 11, x: 1024, y: 1023 }, 0.5, 0.5, 1 / 16, heights!.sampler);
```

A tile service converts sources with heights along the normal of an ellipsoid with `radialHeightOnRay`.

## Continuous surfaces

`DemPyramid` is a raster pyramid of height grids. Its source declares its `registration`, which is required: see [Declaring the registration](../raster/README.md#declaring-the-registration), which also covers the deprecated `prestitched`. A DEM tile in `area` registration loads with its eight neighbours and its heights move to the corners of its pixels, so that neighbouring tiles share their edge heights; tiles beyond `maxLOD` sample a sub-area of their ancestor.

```ts
import { ChildHeightRanges, DemPyramid, selectSurfaceLevels, webDemTileLoader, webMercatorSurfaceNormal } from "@spacexr/dem";

const childHeightRanges = new ChildHeightRanges();
const pyramid = new DemPyramid({ registration: dem.source.registration, load: webDemTileLoader(dem, decoder), maxLOD: 15, wrapX: true, childHeightRanges });

const heights = await pyramid.tileHeights({ lod: 17, x: 67000, y: 45000 });
const height = heights?.sampler(0.5, 0.5); // u east, v south over the tile
const bounds = childHeightRanges.rangeFor({ lod: 18, x: 134000, y: 90000 }); // prepared from the parent DEM

// A point on the edge between tiles of levels 16 and 17, x east and y south over the pyramid.
const levels = selectSurfaceLevels([16, 17], "coarsest");
const surface = pyramid.surfaceHeight(x, y, levels);
const gradient = pyramid.surfaceGradient(x, y, levels, 16); // one step per cell of a 16-cell grid
const normal = gradient && webMercatorSurfaceNormal(gradient, up, verticalScale);
```

## Decoding off the rendering thread

Decoding one 256 px PNG tile takes about 60 ms in a browser, which would stall rendering if it ran on the main thread. DEM tiles therefore go through the `IDemDecoder` port:

- `WorkerDemDecoder` sends each tile to the least busy worker of a pool. The tile bytes are transferred to the worker and the heights are transferred back, so neither is copied. Aborting a request settles it immediately.
- `installDemDecoderWorker(self)` serves those requests inside the worker. The package does not create workers itself, because each bundler has its own worker syntax; the application provides a one-line worker module:

```ts
// dem-decoder.worker.ts
import { installDemDecoderWorker } from "@spacexr/dem";
installDemDecoderWorker(self);
```

- `LocalDemDecoder` decodes on the calling thread, for tests, Node.js or code already running in a worker.

Image bytes become pixels through the `IImageDecoder` port of `@spacexr/raster`.

See the repository document `docs/dem.md` for the cross-language rules.

## License

Apache-2.0.
