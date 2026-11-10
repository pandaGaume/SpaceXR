# Web tiles

Rules shared by every implementation of the web tile layer (`@spacexr/tiles` for Node.js, future .NET and C++ equivalents). The layer is independent of 3D Tiles and of the tile content; runtimes adapt it into implicit tilesets.

## Addressing

- A tile address is `(lod, x, y)` in the XYZ convention, with a `face` for pyramids of several roots such as the [cube index](celestial-tiling.md#tiles): level 0 has one tile, `x` grows eastward and `y` grows southward from the north-west corner. Level `lod` has `2^lod` tiles per axis.
- TMS rows grow northward: `y_tms = 2^lod - 1 - y_xyz`. The conversion is its own inverse.
- A Bing Maps quadkey has one digit per level, from the coarsest: `digit = x_bit + 2 * y_bit`. Level 0 is the empty string.
- Children of `(lod, x, y)` are `(lod + 1, 2x + i, 2y + j)` for `i, j` in `{0, 1}`, ordered north-west, north-east, south-west, south-east.

## Neighbours

Positions around a tile follow the SpaceXR `NeighborsIndex`, a 3 x 3 layout numbered row-major from the north-west, with the tile itself at the centre:

```text
NW N NE      0 1 2
W  C  E      3 4 5
SW S SE      6 7 8
```

- Neighbour `n` at the same level is `(lod, x + n mod 3 - 1, y + floor(n / 3) - 1)`.
- `N`, `E`, `S` and `W` share an edge with the tile; `NW`, `NE`, `SE` and `SW` share only a corner. Each corner joins two edges: `NW` joins `N` and `W`, `NE` joins `N` and `E`, `SE` joins `S` and `E`, `SW` joins `S` and `W`.
- A neighbour beyond the pyramid does not exist. Rows never wrap; columns wrap around the antimeridian only when requested, for pyramids covering every longitude.

## Web Mercator metrics

EPSG:3857 with latitudes clamped to plus or minus 85.0511287798066 degrees.

- Normalized position: `u = (lon + 180) / 360`, `v = 0.5 - ln((1 + sin(lat)) / (1 - sin(lat))) / (4 * pi)`.
- Tile of a position: `floor(u * 2^lod)`, `floor(v * 2^lod)`, clamped to `2^lod - 1` so that the east and south edges belong to the last tile.
- Ground resolution in metres per pixel: `cos(lat) * 2 * pi * a / (tileSize * 2^lod)`, where `a` is the semi-major axis of the ellipsoid.

## URL templates

| Variable                  | Value                                              |
| ------------------------- | -------------------------------------------------- |
| `{z}`, `{lod}`, `{level}` | level of detail                                    |
| `{x}`                     | column                                             |
| `{y}`                     | XYZ row                                            |
| `{-y}`                    | TMS row                                            |
| `{quadkey}`               | Bing Maps quadkey, within the face                 |
| `{face}`                  | face of the cube index, 0 for single-root pyramids |
| `{s}`                     | `subdomains[(x + y) mod n]`                        |
| `{name}`                  | application variable, URI-encoded                  |

An unknown variable, `{s}` without subdomains, or an application variable named like a built-in one is an error raised when the source is created. The subdomain choice is deterministic so that a tile is always requested from the same host, which preserves HTTP caching.

## HTTP

| Response                                         | Outcome                                          |
| ------------------------------------------------ | ------------------------------------------------ |
| 2xx with a body                                  | tile bytes                                       |
| 204, 404                                         | the tile is absent; not an error                 |
| network error, 408, 425, 429, 500, 502, 503, 504 | retried                                          |
| any other status, or attempts exhausted          | error carrying the URL, status and attempt count |

The delay before attempt `n + 1` is `min(maxDelay, initialDelay * 2^(n - 1)) + random * initialDelay`, or the `Retry-After` value, capped by `maxDelay`. Defaults: 4 attempts, 500 ms initial delay, 30 s maximum delay. Cancellation interrupts both requests and delays.

## Tile pyramids

A tile pyramid loads the content of its tiles on demand, whatever that content is: rasters, meshes or vector data.

- Each tile loads once; concurrent requests share the pending load.
- A tile deeper than `maxLOD` is served by its ancestor at `maxLOD` (overzoom). It covers the area `west = (x - ax * 2^d) / 2^d`, `north = (y - ay * 2^d) / 2^d`, `size = 1 / 2^d` of the ancestor `(maxLOD, ax, ay)`, `d` levels above, in normalized ancestor coordinates.
- Neighbours listed for prefetch load with every tile, at the level of the tile serving it. A missing or failing neighbour does not fail the request; a failing tile leaves the cache so that it can be retried.
- The least recently used tiles leave the cache once it holds more than its capacity, 256 tiles by default. A tile evicted while it loads is dropped when its load completes.
- A user can retain the tile serving a tile, for example while a renderer displays data sampled from it: retained tiles never leave the cache, which may then exceed its capacity, until they are released as many times.

Rasters and DEMs build on this pyramid; see [Rasters](raster.md) and [Digital elevation models](dem.md).

Web Mercator leaves the poles out. [Celestial tiling](celestial-tiling.md) specifies a cube tiling covering whole bodies, with an address `(face, lod, x, y)` extending this one.
