# Celestial tiling

Rules shared by every implementation that tiles a celestial body, the Earth, the Moon, Mars or any other: the Node.js packages, future .NET and C++ equivalents, and the tile services that produce the data. Web Mercator stops at 85.05 degrees and leaves the poles out; this specification covers the whole body with one tiling, independent of its shape and size.

Status: the cube index, its neighbours, the reference surface, datasets, radial DEMs and cube tilesets are implemented in the Node packages; layers in other schemes are not implemented yet. [Responsibilities](#responsibilities) lists where each part lives.

## Three geometries

Three geometries are kept apart. Mixing them up moves the relief, by tens of metres on the Earth and by far more on very flattened bodies.

| Geometry          | Defined by                                         | Used for                                      |
| ----------------- | -------------------------------------------------- | --------------------------------------------- |
| Index sphere      | the unit sphere of directions, cut by the cube     | tile addressing, neighbours, sample positions |
| Reference surface | an ellipsoid of the body, declared by each dataset | the zero of heights, normals of the reference |
| Physical surface  | the reference surface and the heights of a DEM     | terrain geometry, bounding volumes, picking   |

Tile addressing depends on none of the shape, the size or the vertical datum of the body: the same tile is the same set of directions on every body.

## Body-fixed frame

- Positions are Cartesian, in metres, in the body-fixed frame of the dataset: origin at the centre of mass, `+Z` toward the north pole, `+X` toward the prime meridian on the equator, `+Y` completing a right-handed frame, toward longitude 90 degrees east.
- Latitudes and longitudes are planetocentric, longitudes positive eastward: a direction is `d = (cos(lat) cos(lon), cos(lat) sin(lon), sin(lat))`. A planetocentric latitude is never used as a geodetic one: they differ by up to 0.19 degrees on the Earth, 0.34 on Mars, 3.84 on Jupiter and 5.90 on Saturn.
- Each dataset names its frame and its version, since bodies have several. For the Moon, LOLA products use the Mean Earth/Polar Axis frame (`MOON_ME`), which differs from the Principal Axis frame (`MOON_PA`) by several hundred metres on the surface.
- Body catalogues, such as `@spacexr/celestial-core`, give the orientation of the frame and a reference ellipsoid of the body. A dataset may use another reference surface: LOLA heights are relative to a 1737.4 km sphere, while the catalogue ellipsoid of the Moon has an equatorial radius of 1738.1 km. Heights are always relative to the reference surface declared by their dataset.

## Cube index

### Faces

The index sphere is cut by a cube whose faces are numbered as follows. A face is given by its centre `C`, the direction `U` in which its `u` coordinate grows and the direction `V` in which its `v` coordinate grows.

| Face | Centre                     | `C`        | `U`        | `V`        |
| ---- | -------------------------- | ---------- | ---------- | ---------- |
| 0    | latitude 0, longitude 0    | `(1,0,0)`  | `(0,1,0)`  | `(0,0,-1)` |
| 1    | latitude 0, longitude 90 E | `(0,1,0)`  | `(-1,0,0)` | `(0,0,-1)` |
| 2    | latitude 0, longitude 180  | `(-1,0,0)` | `(0,-1,0)` | `(0,0,-1)` |
| 3    | latitude 0, longitude 90 W | `(0,-1,0)` | `(1,0,0)`  | `(0,0,-1)` |
| 4    | north pole                 | `(0,0,1)`  | `(0,1,0)`  | `(1,0,0)`  |
| 5    | south pole                 | `(0,0,-1)` | `(0,1,0)`  | `(-1,0,0)` |

- On the four equatorial faces, `u` grows eastward and `v` southward, as in [web tiles](tiles.md#addressing). The polar faces continue face 0 without rotation: face 4 is north of face 0, face 5 south of it.
- On every face, `U x V = -C`: seen from outside the body, `u` runs to the right and `v` downward, like the columns and rows of an image.

### Equi-angular mapping

The cube coordinates are spaced by equal angles, which keeps the area of the cells of one face within a ratio of 1.41, against 5.16 for a plain gnomonic cube.

- Face coordinates `(u, v)` in `[0, 1]` give the direction `d = normalize(C + tan(pi/4 * (2u - 1)) * U + tan(pi/4 * (2v - 1)) * V)`.
- A direction `d` belongs to the face of its largest absolute component, its sign giving the face: `+X` 0, `+Y` 1, `-X` 2, `-Y` 3, `+Z` 4, `-Z` 5. Ties go to the first axis in the order `X`, `Y`, `Z`, so a direction on a cube edge belongs to an equatorial face.
- On its face, `u = (atan(d.U / d.C) / (pi/4) + 1) / 2` and likewise `v` with `V`.

### Tiles

- A tile address is `(face, lod, x, y)`: one quadtree per face, following the [web tile addressing](tiles.md#addressing) in `u` and `v`. Level `lod` has `2^lod` tiles per axis on each face, `6 * 4^lod` in all.
- The tile of a direction at level `lod` is `floor(u * 2^lod)`, `floor(v * 2^lod)` on its face, clamped to `2^lod - 1`.
- URL templates add the variable `{face}` to those of [web tiles](tiles.md#url-templates).
- Addresses of single-root pyramids, such as Web Mercator, have face 0. Tile keys stay ephemeral: they are not stable identifiers.

### Neighbours across faces

Inside a face, neighbours follow [web tiles](tiles.md#neighbours). Across a face edge, the edge of the tile meets an edge of the neighbouring face, possibly turned and reversed:

| Face | `N`            | `E`            | `S`            | `W`            |
| ---- | -------------- | -------------- | -------------- | -------------- |
| 0    | 4 `S`          | 1 `W`          | 5 `N`          | 3 `E`          |
| 1    | 4 `E` reversed | 2 `W`          | 5 `E`          | 0 `E`          |
| 2    | 4 `N` reversed | 3 `W`          | 5 `S` reversed | 1 `E`          |
| 3    | 4 `W`          | 0 `W`          | 5 `W` reversed | 2 `E`          |
| 4    | 2 `N` reversed | 1 `N` reversed | 0 `N`          | 3 `N`          |
| 5    | 0 `S`          | 1 `S`          | 2 `S` reversed | 3 `S` reversed |

- The coordinate along an edge is `x` on the `N` and `S` edges and `y` on the `E` and `W` edges. With `n = 2^lod`, the tile across an edge at position `k` is at position `k' = k`, or `n - 1 - k` when the edge is reversed, along the neighbour's edge: `(k', 0)` on its `N` edge, `(n - 1, k')` on `E`, `(k', n - 1)` on `S`, `(0, k')` on `W`.
- The neighbour's edge is the opposite of the tile's edge turned by `r` quarter turns: `edge' = order[(index(edge) + 2 + r) mod 4]` in the order `N, E, S, W`. Equatorial faces join with `r = 0`, like columns wrapping around the antimeridian; faces 1 to 3 join the polar faces with `r` of 1 to 3. A renderer turns the junction of an edge, its heights and its imagery by `r`.
- The edges of the two faces are the same arc, and their parameters are equal or opposite, so the samples of point registration, at `i / (size - 1)` along an edge, are the same directions on both sides, at every level.
- A corner neighbour is reached by crossing either of its two edges, then moving along the edge of the neighbour. Both paths reach the same tile, except at the 8 vertices of the cube, where 3 tiles meet instead of 4: there, the corner neighbour does not exist, and the two paths reach the two other tiles of the vertex.

### Resolution

On the central lines of a face, the samples of a tile of `tileSize` cells are `pi / 2 * R / (tileSize * 2^lod)` apart, `R` being the radius of the body. With 256 cells:

| Body  | Level 8 | Level 11 | Level 14 |
| ----- | ------- | -------- | -------- |
| Moon  | 41.6 m  | 5.2 m    | 0.65 m   |
| Mars  | 81.4 m  | 10.2 m   | 1.27 m   |
| Earth | 152.9 m | 19.1 m   | 2.39 m   |

The geometric error of a terrain tile is the longest of its four edges, measured as the chord between its corners on the reference surface, divided by `tileSize`. It follows the distortion of the cube instead of assuming a size per level.

## Reference surface

- The reference surface is a triaxial ellipsoid with radii `a`, `b`, `c` along `X`, `Y`, `Z`. A biaxial ellipsoid has `a = b`, a sphere `a = b = c`.
- The reference point of a direction `d` is `r_ref(d) * d`, with `r_ref(d) = 1 / sqrt(dx^2 / a^2 + dy^2 / b^2 + dz^2 / c^2)`: the intersection of the ray from the centre with the ellipsoid.
- The normal of the reference surface at a point `p` is `normalize(px / a^2, py / b^2, pz / c^2)`. It differs from `d` on a non-spherical surface.
- No geodetic latitude is needed by the tiling, so triaxial bodies need no special case.

## Terrain heights

- A terrain height is radial: the physical point of direction `d` and height `h` is `P = (r_ref(d) + h) * d`. Every vertex then lies on the ray of its direction, and the tile of a physical point is the tile of its direction.
- Radial heights are native in LOLA and MOLA products, which give radii. Sources with heights along the normal, such as Copernicus on the Earth after its geoid correction, are converted by finding the point of the relief on the ray; using the normal height unchanged would move the relief horizontally by `h * sin(lat_geodetic - lat_planetocentric)`, about 25 m at the top of Everest.
- Converting a source sample is the work of the tile service: its horizontal and vertical datums, such as a geoid or an areoid, are converted first into a body-fixed Cartesian position, then into a radial height over the declared reference surface. Clients never apply a datum.
- A height along the normal, or above a geoid, is a derived value a client may compute for display. It is not stored.
- Elevation tiles hold `(tileSize + 1)^2` samples in point registration, from the north-west corner, rows southward, as [stitched rasters](raster.md#stitching). Neighbouring tiles, across a face edge included, hold the same samples on their shared edge, without any request to their neighbours.
- Bodies without a solid surface, such as Jupiter and Saturn, only have imagery over their reference surface.

## Vertical scale

A scene has one vertical scale `s`, shared by everything in it: terrain, picking, tile bounds, the camera and objects. Changing it changes all of them.

- The terrain point of height `h` moves to `P = (r_ref(d) + s h) * d`. Volumes of terrain tiles use `s` times their height range, and follow its changes when the runtime is given the scale. Web Mercator runtimes are not given it: their tiles keep the volumes of the scale they were loaded with.
- An object moves as a whole by `h (s - 1)` along its up direction, `h` being the height of its origin. An object placed on the terrain stays on it. It is not stretched: its size stays true, and its parts keep their places.
- The first tile with a position, from the root down, is an object, with all its descendants. A tile above any object moves with the centre of its volume, and grows by `r |s - 1|` to keep the objects of other heights inside.
- A wide object follows the terrain at its origin only: to follow the relief, its parts must be separate objects.
- The scale is a display parameter. It never changes tile data or wire values.

## Imagery

- Imagery tiles follow the [raster](raster.md) and [draping](draping.md) rules with the address `(face, lod, x, y)`, and hold `(tileSize + 1)^2` samples in point registration, like elevation tiles. Pixels in area registration could not be stitched across faces: where a `S` edge meets an `E` edge, both sides lack the samples of their shared edge.

## Bounding volumes and other content

- The index footprint of a tile is a set of directions; its bounding volume encloses its physical geometry. Culling, picking and screen-space error use the bounding volume.
- The bounding volume of a terrain tile is an oriented box containing `(r_ref(d) + h) * d` for every direction `d` of the tile and every `h` of its height range. It is computed from at least 5 x 5 directions of the tile at both bounds of the range, enlarged by the sagitta `r * (1 - cos(delta / 2))`, `delta` being the angle between neighbouring directions of that grid and `r` the largest radius.
- Content that is not a height field, such as buildings, glTF models, tunnels, or the surface of a non-convex body like a comet, is indexed by the tile of its anchor and keeps its own geometry: its bounding volume may leave the footprint of the tile. 3D Tiles bounding volumes already describe that geometry.
- The normal of terrain comes from the gradient of the heights over the samples of the source, by central differences. It is never computed on levels interpolated below the source, whose slope is constant by parts and shows as a checkerboard. On the edge of a tile, the sample beyond is read in the tile across, turned across a cube face: both sides compute the same slope.
- A tile lies beyond the horizon of a sphere of radius `r` when its angle from the camera, at distance `c` from the centre, exceeds `acos(r / c) + acos(r / p)`, `p` being the distance of the highest point of the tile. Its heights are measured when its DEM tile is decoded, or prepared by its parent. The hiding sphere must be solid, and the reference surface is not, as 46.6 % of the level 6 tiles of the Moon lie wholly below a reference of 1738.1 km. Nor is a sphere through the lowest point of the tile: a sight line may pass over a deeper basin on its way to a far rim. `r` lies below the lowest terrain of the body, as declared or measured so far. A tile without known heights takes them from its bounding sphere.
- Tiles are selected for a camera that has already moved when they are drawn, so a renderer selects them in a frustum wider than the view, and draws a whole cover of the body: where the selection left no tile, the coarser tiles beside the cut, reading the DEM of their nearest ancestor in memory until theirs arrives. No margin is enough on its own, as a camera accelerates faster than any prediction, and coarse terrain for a moment is better than a hole.
- In 3D Tiles, a cube tileset has an explicit root with six children, one per face, each carrying its implicit quadtree, and oriented `box` bounding volumes: a `region` cannot describe a polar face.

## Layers in other schemes

Many imagery and elevation layers are published in Web Mercator (EPSG:3857), geographic (EPSG:4326) or polar stereographic projections, and their licences often forbid caching or transforming their tiles. A renderer drapes them over cube terrain itself; a tile service does not reproject them.

- Each layer declares its scheme. A layer in the scheme of the terrain uses the existing binding: the tile covers an area `west, north, size` of a page, an affine mapping.
- A layer in another scheme is reprojected per vertex: for each terrain tile and layer, the layer coordinates of every vertex are computed in double precision, relative to the origin of the block of layer pages covering the tile, and interpolated within each cell. Cells are small enough for the interpolation error to be negligible, and relative coordinates keep single precision exact on the GPU.
- Shared edges stay identical: the layer coordinates of a vertex depend only on its direction.
- Layers are stacked; each declares its coverage. A Web Mercator layer has no data beyond 85.05 degrees, and the next layer of the stack, a polar or a cube layer, covers the cap.

## Dataset descriptor

Generating a dataset from a raster source is described in [From a raster source to the cube](cube-sources.md).

A tile service describes each dataset with a descriptor:

```json
{
  "scheme": "spacexr-cube-equiangular/1",
  "body": "Moon",
  "frame": "MOON_ME",
  "referenceRadii": [1737400, 1737400, 1737400],
  "content": "elevation",
  "encoding": "terrarium",
  "tileSize": 256,
  "minLOD": 0,
  "maxLOD": 7,
  "subtrees": [{ "face": 5, "lod": 0, "x": 0, "y": 0, "maxLOD": 11 }],
  "tiles": "https://tiles.example.com/moon/lola/{face}/{z}/{x}/{y}.png"
}
```

| Member             | Meaning                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `scheme`           | this specification and its version                                                               |
| `body`             | catalogue name of the body                                                                       |
| `frame`            | body-fixed frame and its version                                                                 |
| `referenceRadii`   | `a`, `b`, `c` of the reference surface, in metres                                                |
| `content`          | `elevation` or `imagery`                                                                         |
| `encoding`         | tile format, such as `terrarium` for radial heights or `png`, `jpeg`, `webp` for imagery         |
| `tileSize`         | cells per tile side: tiles hold `tileSize + 1` samples per side                                  |
| `minLOD`, `maxLOD` | levels available everywhere                                                                      |
| `subtrees`         | tiles below which levels down to their own `maxLOD` are available, as the polar caps of the Moon |
| `tiles`            | URL template                                                                                     |

A client never requests a tile outside the declared availability. The depth of a dataset varies from place to place: a client reads a tile deeper than the data at its place as a sub-area of the deepest tile there, and two tiles sharing an edge read the coarser of their data along it, so that they join where a finer source starts.

## Web Mercator

Web Mercator is the official terrain engine, and the cube an alternative under test. What the cube needs stays out of the Web Mercator path: tilings, shader defines and opt-in options, never shared defaults. A view of Web Mercator must render the same pixels with or without the cube code.

Web Mercator remains a tiling scheme for layers and terrain served in XYZ, without a tile service. Its terrain heights stay geodetic, along the normal of the ellipsoid, and it leaves the poles out. A renderer selects the scheme of its terrain; the engines, the grid topologies and the runtime are the same for both.

## Responsibilities

| Component                   | Part                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@spacexr/tiles`            | tiling scheme interface: roots, directions and positions, inverse, edge table with turns, corners of 3 tiles; Web Mercator, geographic, polar stereographic and cube schemes; `{face}` |
| `@spacexr/grid`             | geometry of a grid tile on a scheme and a reference surface, in double precision                                                                                                       |
| `@spacexr/raster`           | layers in other schemes, layer stacks, edge and corner heights across turned edges                                                                                                     |
| `@spacexr/dem`              | radial heights, already stitched elevation tiles, normals of any scheme                                                                                                                |
| `@spacexr/3d-tiles-runtime` | one implicit root per face, face in tile keys, oriented boxes                                                                                                                          |
| `@spacexr/celestial-core`   | body catalogue and orientation; applications pass the reference surface to the tiling, which does not depend on it                                                                     |
| Tile service                | source datums and projections, conversion to radial heights, descriptor and availability                                                                                               |
| Renderers                   | turned junctions, picking, lighting from the body orientation, navigation around the poles                                                                                             |

`@spacexr/geodesy` ellipsoids have two axes: the reference surface of the tiling takes the three radii of the descriptor.
