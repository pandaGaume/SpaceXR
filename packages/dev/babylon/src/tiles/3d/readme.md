# 2D Tiles vs. 3D Tiles — Relationship and Streaming Logic

## Hierarchy and Subdivision

-   **2D tiles (imagery, DEM, vector)**

    -   Organized in a fixed grid hierarchy `(zoom, x, y)`.
    -   Each level of detail (LOD) subdivides the grid into smaller, regular cells.
    -   DEM tiles may encode elevation, but they are still addressed as part of a 2D grid.

-   **3D Tiles**
    -   Organized in a spatial hierarchy (octree or quadtree) based on bounding volumes (boxes, spheres, regions).
    -   Each tile refines a spatial volume, not a fixed grid cell.
    -   A 2D tiling grid is essentially a subset of this more general 3D subdivision, restricted to regularly spaced cells on a projected plane.

---

## Streaming and LOD Control

-   **2D streaming**

    -   Driven by three factors:
        1. LOD (zoom level)
        2. Location (x, y index in the grid)
        3. Camera (viewport defines which tiles are visible)
    -   Requests are predictable because tiles can be addressed directly from `(zoom, x, y)`.

-   **3D streaming**
    -   Driven only by the camera.
    -   The renderer evaluates each tile’s bounding volume against the current view using a screen-space error (SSE) metric.
    -   Refinement happens dynamically as the camera moves or zooms, without a fixed addressing scheme.

---

## DEM vs. 3D Tiles Terrain

-   **DEM tiles**

    -   Standardized as raster elevation grids (e.g., Web Mercator or WGS84-based tile services).
    -   Provide elevation values per pixel, usually aligned with the 2D grid system.
    -   Widely supported in traditional mapping pipelines.

-   **3D Tiles**
    -   The OGC 3D Tiles specification does **not** define any ontology for DEM, terrain, or raster elevation grids.
    -   Vendors choose how to represent terrain inside the 3D Tiles hierarchy:
        -   Google’s Photorealistic 3D Tiles include terrain meshes directly inside each tile (in ECEF coordinates).
        -   Cesium’s standard 3D Tiles datasets usually focus on buildings/objects; terrain is often served separately as quantized-mesh or heightmaps.
        -   Other vendors may omit terrain entirely and only provide object/mesh data.
    -   This means DEM integration is **vendor-specific** and not guaranteed by the 3D Tiles standard.

---

## Structural vs. Ontological Model

-   **2D tiles** implicitly encode semantics:

    -   Imagery tiles are always images, DEM tiles are always elevation grids, vector tiles carry features with geometry and attributes.
    -   The ontology (what the data _means_) is tied to the tile service definition.

-   **3D Tiles** are purely structural:
    -   They define **how tiles are organized** (hierarchy, bounding volumes, geometric error, refinement rules).
    -   They do **not** prescribe what the content represents (terrain, buildings, point clouds, photogrammetry, etc.).
    -   Content formats like `b3dm`, `i3dm`, `pnts`, `glTF`, or vendor-specific payloads carry the actual data, and its meaning depends on the provider.

---

## Comparison: 2D Tiles vs. 3D Tiles

| Aspect              | 2D Tiles (imagery, DEM, vector)                          | 3D Tiles (OGC 1.0 / 1.1)                                  |
| ------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| **Hierarchy**       | Fixed grid `(zoom, x, y)`                                | Spatial hierarchy (octree / quadtree on bounding volumes) |
| **Subdivision**     | Regular grid cells                                       | Arbitrary bounding boxes, spheres, or regions             |
| **Addressing**      | Deterministic and predictable (zoom/x/y)                 | No fixed addressing; only parent-child relationships      |
| **LOD control**     | By zoom level                                            | By geometric error per tile                               |
| **Streaming logic** | Based on LOD + location (grid index) + camera (viewport) | Based only on camera view and screen-space error (SSE)    |
| **Coordinate ref.** | Map projections (Web Mercator, WGS84, etc.)              | Cartesian ECEF (Earth, Moon, or arbitrary body)           |
| **Ontology**        | Fixed: imagery, DEM, vector feature schemas              | None: vendor defines meaning of each content payload      |
| **Scope**           | Maps and surfaces, including elevation (DEM)             | Generalized to terrain, buildings, cities, planetary data |

---

## Key Point

-   2D tile hierarchies are a special case of 3D spatial tiling.
-   3D Tiles generalize the concept by replacing fixed grid cells with bounding volumes that can represent terrain patches, buildings, or entire planetary surfaces.
-   The difference in streaming is fundamental:
    -   **2D tiles = LOD + location + camera**
    -   **3D tiles = camera-driven only (through SSE against bounding volumes)**
-   Importantly, **3D Tiles do not define an ontology**. They only describe how to structure and refine spatial data. The interpretation of the content (terrain, DEM, buildings, photogrammetry) is entirely vendor-dependent.
