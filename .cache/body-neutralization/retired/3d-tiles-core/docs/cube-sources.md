# From a raster source to the cube

Brief for a tile service that generates the tiles of the [cube index](celestial-tiling.md): Moon Trek and the other Solar System Treks of NASA, then WGS84 sources. The code of every step is in `@spacexr/tiles/reprojection`, without any XML library or renderer, so it also runs in a Cloudflare Worker. Height conversions are in `@spacexr/dem`.

## The tile to produce

| Item       | Value                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Address    | `face/z/x/y`, 6 faces                                                                             |
| Samples    | `(tileSize + 1)^2`, 257 x 257 by default, on the edges of the tile, rows from the north-west      |
| Elevation  | radial height over the reference surface of the dataset, Terrarium in a lossless PNG              |
| Imagery    | the same samples, in any format of the dataset                                                    |
| No data    | `NaN`, which Terrarium encodes as a transparent pixel                                             |
| Descriptor | [the dataset descriptor](celestial-tiling.md#dataset-descriptor), read by `parseCelestialDataset` |

**A sample depends on its direction and its level alone, never on the tile asking for it.** This is what makes the edges of two tiles identical, across cube faces included. Coarse levels are therefore read from coarse levels of the source, never by averaging the tiles below them.

## The formulas

**1. Sample to direction.** For the sample `(i, j)` of the tile `(face, lod, x, y)`, with `C`, `U` and `V` the [frame of the face](celestial-tiling.md#faces):

```text
u = (x + i / tileSize) / 2^lod
v = (y + j / tileSize) / 2^lod
d = normalize(C + tan(pi/4 (2u - 1)) U + tan(pi/4 (2v - 1)) V)
```

**2. Direction to map.** The map position in the projection of the source:

| Source                      | `x`                  | `y`                                                   | Unit    |
| --------------------------- | -------------------- | ----------------------------------------------------- | ------- |
| Geographic, on a sphere     | `atan2(d.y, d.x)`    | `atan2(d.z, hypot(d.x, d.y))`                         | degrees |
| Geographic, on an ellipsoid | `atan2(d.y, d.x)`    | `atan2(d.z a^2 / b^2, hypot(d.x, d.y))`               | degrees |
| South polar stereographic   | `2R d.y / (1 - d.z)` | `2R d.x / (1 - d.z)`                                  | metres  |
| North polar stereographic   | `2R d.y / (1 + d.z)` | `-2R d.x / (1 + d.z)`                                 | metres  |
| Web Mercator, EPSG:3857     | `a atan2(d.y, d.x)`  | `a ln tan(pi/4 + phi/2)`, `phi` the geodetic latitude | metres  |

The polar forms use no latitude or longitude, so the pole is a point like any other. With a `central_meridian` `m`, `d.x` and `d.y` are first turned by `-m`. These forms are for a sphere: the polar maps of the Earth need the formulas of the ellipsoid, see [below](#wgs84-sources).

**3. Map to pixel.** Every source declares its registration, in `registration` of its tile matrix: WMTS and XYZ tiles are `area`, and a GeoTIFF states it in `GTRasterTypeGeoKey`. In `area`, shown here, the origin is the corner of the first pixel. In `point`, it is the first sample, and the `0.5` goes away. Pixel `n` has its centre at `n`:

```text
px = (x - originX) / pixelSize - 0.5        py = (originY - y) / pixelSize - 0.5
TileCol = floor(px / tileWidth)             TileRow = floor(py / tileHeight)
```

Columns wrap around a global map. A position beyond the matrix has no data.

**4. Level of the source.** The coarsest level at least as fine as the cube, the last one otherwise. The cube has a spacing of `pi/2 R / (tileSize 2^lod)`; on a global geographic source the rule gives `lod + 1`. It depends on the level of the cube alone.

**5. Value.** The four nearest pixels, interpolated bilinearly, leaving out those without data. Sample several levels or several sources by this same rule: they stay functions of the direction.

**6. Height.** See [Heights](#heights).

## The code

```ts
import {
  GeographicProjection,
  cubeSourceMatrix,
  cubeTileSourceTiles,
  parseWmtsCapabilities,
  resampleCubeTile,
  wmtsTileUrl,
} from "@spacexr/tiles/reprojection";

const R = 1737400;
const projection = new GeographicProjection({ semiMajorAxis: R });
const layer = parseWmtsCapabilities(
  await (await fetch(`${endpoint}/1.0.0/WMTSCapabilities.xml`)).text(),
);

const address = { face: 5, lod: 3, x: 3, y: 3 };
const source = {
  projection,
  matrix: cubeSourceMatrix(projection, layer.matrices, R, address.lod),
};

// 1. The tiles of the source that this tile of the cube reads.
const tiles = new Map();
for (const { column, row } of cubeTileSourceTiles(address, source))
  tiles.set(
    `${column}/${row}`,
    await load(wmtsTileUrl(layer, source.matrix, row, column)),
  );

// 2. The 257 x 257 samples, as a Float32Array; NaN where the source has no data.
const samples = resampleCubeTile(
  address,
  source,
  (column, row, x, y, channel) =>
    tiles.get(`${column}/${row}`)?.pixel(x, y, channel) ?? NaN,
);
```

`load` decodes a tile and `pixel` reads it: they depend on the format of the source. For elevation, the samples then go through `encodeTerrariumGrid` of `@spacexr/dem`.

## Solar System Treks

### Finding a layer

| What                           | Where                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endpoints and CRS of each body | `https://trek.nasa.gov/tiles/apidoc/config/config.json`                                                                                                                    |
| Layers of a map                | `https://trek.nasa.gov/{body}/TrekServices/ws/index/{eq or polar}/searchItems?proj={crs}&start=0&rows=2000&facetKeys=itemType%7CserviceTypes&facetValues=product%7CMosaic` |
| Services of a layer            | `https://trek.nasa.gov/{body}/TrekServices/ws/index/getLayerServices?uuid={item_UUID}`                                                                                     |
| Capabilities of a WMTS layer   | `{endpoint}/1.0.0/WMTSCapabilities.xml`                                                                                                                                    |

The catalogue gives the WKT of a layer in `projection`, and `PIXEL_DEPTH`, `RASTER_TYPE` and `productCat2`. The services give a `Mosaic` endpoint, the WMTS, and on some layers a `raster` endpoint, an ArcGIS ImageServer.

### Heights: the ImageServer, not the WMTS

**A WMTS tile holds an image.** Even a layer named `DEM` is served as 8-bit PNG tiles for display: a tile of `LRO_LOLA_DEM_Global_128ppd_v04` holds 142 grey levels, for a relief of about 20 km. Products such as `LRO LOLA DEM, ColorHillshade` are derived images in RGBA. None of them gives heights, which only suits imagery.

Real heights come from the `raster` endpoint of a layer whose catalogue entry says `Float32` and `raw`:

```text
{raster}/exportImage?bbox=xmin,ymin,xmax,ymax&size=w,h&format=tiff&pixelType=F32&f=json
{raster}/identify?geometry={"x":x,"y":y}&geometryType=esriGeometryPoint&returnGeometry=false&returnCatalogItems=false&f=json
```

`exportImage` returns the address of a TIFF, up to 15000 pixels per side on the layers read. Not every DEM has this endpoint: `LRO_LOLAKaguya_DEM_60N60S_512ppd` has none. To generate a whole body, prefer the original GeoTIFF of the product, such as those of USGS or PGDA, over thousands of requests. The terms of use of each source remain to be read before storing its tiles.

### What the capabilities do not say

| Trap                                                                                                                | Rule                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ScaleDenominator` assumes degrees on the Earth on geographic layers, and is 0.64 % off on the polar layers of Mars | Take the pixel from the matrix, `2 originY / (MatrixHeight TileHeight)`, as `parseWmtsCapabilities` does                                 |
| Polar layers write `EPSG::0` as their CRS                                                                           | Read the WKT in the catalogue                                                                                                            |
| A polar level 0 has 2 x 1 tiles, but its map fits in the first one                                                  | Trust the position, not `MatrixWidth`: the pole is at the centre of the first column                                                     |
| Old tile matrices stay in XML comments                                                                              | Remove comments first                                                                                                                    |
| Templates hold `1.0.0//{Style}`                                                                                     | Remove the empty path segment, as `wmtsTileUrl` does                                                                                     |
| `central_meridian` is 180 in the WKT of Titan and Ceres layers                                                      | Pass it to the projection, and check it with a known feature: no polar map of Titan was available to check it, and Ceres was not checked |
| The sphere changes between layers: Mercury has 2439.7 and 2439.4 km                                                 | Read the radius layer by layer, not from a body catalogue                                                                                |
| Mars is a sphere of 3396.19 km in Trek, flattened in body catalogues                                                | Declare the radii of the dataset, not those of the catalogue                                                                             |

### Bodies read

46 layers were read. They all share this structure: origin on the axes, 2 x 1 tiles at level 0, a pixel halved at each level.

| Body    | Geographic CRS     | Polar maps | Sphere (km)    | Origin of the polar matrix (m) |
| ------- | ------------------ | ---------- | -------------- | ------------------------------ |
| Moon    | `EPSG::104903`     | NP, SP     | 1737.4         | 1095930                        |
| Mars    | `EPSG::104905`     | NP, SP     | 3396.19        | 1821000                        |
| Mercury | `IAU2000::19900`   | NP, SP     | 2439.7, 2439.4 | 1307271                        |
| Vesta   | `IAU2000::2000004` | NP, SP     | 255            | 510012                         |
| Ceres   | `IAU2000::104972`  | NP, SP     | 470            | 252045                         |
| Titan   | `IAU2000::60600`   | none       | 2575           | none                           |

### What was checked on real data

The same product read through the formulas in its geographic map and in its polar map must agree. A mirrored polar map serves as a control.

| Body, pole   | Measure                                              | Formulas | Mirrored |
| ------------ | ---------------------------------------------------- | -------- | -------- |
| Moon, south  | median difference of heights, 14 points, ImageServer | 5.5 m    | 2074 m   |
| Vesta, south | correlation of pixels, 70 points                     | 0.906    | 0.174    |
| Mars, north  | correlation of pixels, 70 points                     | 0.747    | -0.007   |
| Mars, south  | correlation of pixels, 70 points                     | 0.507    | 0.01     |
| Moon, south  | correlation of hillshades, 70 points                 | 0.442    | 0.224    |

A real polar tile and two real tiles across the turned edge between faces 1 and 4 were generated with the code above: the 257 samples of the shared edge are identical. North poles of the Moon, Vesta and Ceres, Mercury and Titan were only checked for their structure.

## Heights

- Heights are [radial](celestial-tiling.md#terrain-heights): `P = (r_ref(d) + h) d`. A source radial over a sphere is rebased with `rebaseRadialHeight`, which leaves it unchanged when both surfaces are that sphere.
- The units, the scale and the reference come from the label of each file, read before generating. The PDS label of LOLA states a sphere of 1737.4 km, and the 5 m page of PGDA does not state its height reference. A search result gives a scale of 0.5 for the 118 m GeoTIFF of USGS, whose page could not be read: it remains to be checked.
- Layers read: heights from -9126 to 10767 m on the global LOLA DEM, within the range of Terrarium.

## Several sources

The Moon, for example:

| Source                           | Pixel | Coverage                  | Cube level | Tiles down to it                |
| -------------------------------- | ----- | ------------------------- | ---------- | ------------------------------- |
| `LRO_LOLA_DEM_Global_128ppd_v04` | 237 m | global                    | 6          | 32766                           |
| `LRO_LOLA_DEM_SPole75_30mp_v04`  | 30 m  | a square of +/- 457.44 km | 9          | 87380, in 4 subtrees of level 2 |
| `LRO_LOLA_DEM_SPole875_5mp_v04`  | 5 m   | a square of +/- 75.84 km  | 11         | 21844, in 4 subtrees of level 5 |

The subtrees are the four central tiles of face 5: `2/1/1` to `2/2/2`, and `5/15/15` to `5/16/16`. They contain the circles of 75 and 87.5 degrees. A sample reads the finest source covering it, blended over a band with `capBlendWeight`, which depends on the direction alone: for example 76 to 78 degrees, then 87.6 to 88.6 degrees, inside the coverage of the finer source. The band and its values are a choice of the dataset.

## WGS84 sources

The cube is the same: only the map, the latitude and the heights change. **This path has unit tests, against the Web Mercator metrics and the geodetic conversion of `@spacexr/geodesy`, but has not been run on real Earth data.**

| Source          | Projection                                                                               | Tile matrix                                             | Coverage               |
| --------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------- |
| EPSG:4326, WMTS | `new GeographicProjection({ semiMajorAxis: 6378137, semiMinorAxis: 6356752.314245179 })` | from its capabilities, or `geographicTileMatrix(level)` | the poles, oversampled |
| EPSG:3857, XYZ  | `new WebMercatorProjection()`                                                            | `webMercatorTileMatrix(level)`, `y` from the north      | up to 85.05 degrees    |
| TMS             | the same                                                                                 | `y_tms = 2^level - 1 - y`                               | up to 85.05 degrees    |

- **Latitude.** Cube directions are planetocentric; these sources are geodetic: `tan(geodetic) = a^2 / b^2 tan(planetocentric)`. The projections apply it. Confusing them moves the map by 0.19 degrees at 45 degrees of latitude, about 21 km.
- **Corners.** WMTS may write the `TopLeftCorner` of EPSG:4326 latitude first; `parseWmtsCapabilities` reorders it.
- **Poles.** Web Mercator stops at 85.05 degrees: the samples beyond it are `NaN`, and another source must cover the caps. EPSG:4326 reaches them.
- **Polar maps of the Earth are not covered.** EPSG:3031 and EPSG:3413 are stereographic on the ellipsoid, true to scale at 71 and 70 degrees: `PolarStereographicProjection` is for a sphere. Use a projection library behind `ISourceProjection`.
- **Reference surface.** `ReferenceSurface.fromEllipsoid(Ellipsoid.WGS84)`.
- **Heights.** Most Earth DEMs are heights over a geoid, along the normal of the ellipsoid. First add the undulation of the geoid `N` of the source to get the height over the ellipsoid. Then `radialHeightOnRay(direction, reference, GeodeticSystem.WGS84, sample)` finds the point of the relief on the ray: `sample(latitude, longitude)` returns `H + N`. The reference of each source comes from its documentation: Copernicus uses EGM2008.
- **Terms.** Some providers forbid caching or transforming their tiles. Those layers cannot be converted by a service: they wait for the [reprojection in the renderer](celestial-tiling.md#layers-in-other-schemes), which is not implemented yet.

## Checklist of a dataset

1. Read the catalogue entry and the capabilities: format, depth, WKT, radius, central meridian, levels and coverage.
2. Use a numeric source for heights, and read its label: unit, scale, reference.
3. Choose the reference surface and declare it in the descriptor, with the frame.
4. Generate one tile on each side of a face edge, and compare the shared samples: they must be identical.
5. Compare a known feature with the source, and read a source in two of its maps where it has several.
6. Declare the levels and subtrees: a client never requests a tile outside them.
