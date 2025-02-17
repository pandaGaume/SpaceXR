# OGC 3D Tiles 1.0 & 1.1 - Generic Implementation

It is important to note that **3D Tiles do not follow the same logic** as 2D tile metrics and addressing systems. Unlike traditional 2D tile structures (e.g., Web Mercator or WGS84 grids), **3D Tiles rely on an octree or quadtree spatial subdivision**, making their hierarchical structure and rendering logic fundamentally different.

---

## 🌍 3D Tiles & Spatial Hierarchy

-   3D Tiles organize spatial data **in a hierarchical tree**, where each tile may contain metadata about its children.
-   Unlike 2D tiles, which are mapped based on lat/lon and fixed grid zoom levels, **3D Tiles are spatially subdivided using bounding volumes** (e.g., bounding spheres or bounding boxes).
-   The **root tile** typically defines a large bounding volume (e.g., a full city or terrain section), with smaller child tiles progressively refining the details.

---

## ⚠️ Content Format Variability

-   The **content format of 3D Tiles is NOT standardized** beyond the OGC 3D Tiles specification.
-   Different vendors use different strategies to encode and store their 3D data.
-   This means that processing the data requires vendor-specific approaches.

---

## 🌍 **Example: Google Photorealistic 3D Tiles**

-   Google’s **Photorealistic 3D Tiles** store terrain data **directly inside each tile**.
-   These tiles are **positioned in an ECEF (Earth-Centered, Earth-Fixed) coordinate system**, meaning that every vertex of the mesh is encoded in Cartesian (X, Y, Z) coordinates relative to the Earth's center.
-   Elevation and ground information are embedded within each tile at **reasonable Level of Detail (LOD)**, ensuring adaptive rendering with an acceptable error threshold.

---

## 🌙 **Latest Example: Cesium Moon Surface 3D Tiles**

-   **Cesium** has recently introduced **3D Tiles for the Moon’s surface**, following a similar hierarchical octree approach.
-   Unlike Earth-based datasets, these **Moon terrain tiles use an ECEF coordinate system centered on the Moon**.
-   The data is derived from high-resolution lunar topographic datasets, allowing for precise visualization.
-   **Transformations between Moon ECEF and lunar lat/lon coordinates** are required if applications need geodetic representations.

---

## 🚀 **Key Takeaways:**

1. **3D Tiles are NOT equivalent to 2D map tiles** (Web Mercator, WGS84) in terms of addressing or spatial hierarchy.
2. **An octree/quadtree system** is used for 3D Tiles, making rendering and data organization different.
3. **Content formats vary by vendor**, requiring specific processing strategies.
4. **Google 3D Tiles and Cesium Moon 3D Tiles use ECEF coordinates**, which means transformations to geodetic coordinates (lat/lon/alt) may be required for some applications.
5. **Cesium's Moon 3D Tiles are referenced to the Moon's center**, making them incompatible with standard Earth-based rendering pipelines without proper reference frame adjustments.

