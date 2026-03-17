### PLANETARY BODIES

SpaceXR extends beyond Earth-only mapping by providing a comprehensive catalog of solar system bodies, each with geodetic ellipsoids and physical properties. This enables the same tile pipeline architecture used for terrestrial mapping to seamlessly support lunar, Martian, and other planetary surfaces.

---

**Architecture Overview**

The planetary support is organized across three modules, each with a distinct responsibility:

| Module | Responsibility |
|--------|---------------|
| `space/` | Defines planetary bodies — shape (ellipsoid), physical data (radius, gravity), celestial classification |
| `geodesy/` | Provides the `Ellipsoid` mathematical primitive — semi-major axis, flattening, eccentricity |
| `tiles/vendors/` | Tile source vendors — URL builders, client factories, tile fetching for each body |

The `space` module owns **what a body is**. The `tiles/vendors` module owns **how to fetch tiles for it**. The `geodesy/Ellipsoid` class is a mathematical primitive used by both.

---

**Planetary Body Catalog**

The `SolarSystemBodies` catalog in `space/space.bodies.ts` defines each body as an `IPlanetaryBody`:

```typescript
export interface IPlanetaryBody {
    readonly name: string;
    readonly celestialType: CelestialNodeType;
    readonly ellipsoid: Ellipsoid;
    readonly meanRadiusKm: number;
    readonly surfaceGravity: number;  // m/s²
}
```

The following bodies are currently defined:

| Body | Type | Semi-Major Axis (m) | Inverse Flattening | Mean Radius (km) | Surface Gravity (m/s²) |
|------|------|--------------------:|--------------------:|------------------:|-----------------------:|
| Earth | Planet | 6,378,137 (WGS84) | 298.257 | 6,371.0 | 9.807 |
| Moon | Moon | 1,738,100 | ∞ (sphere) | 1,737.4 | 1.622 |
| Mars | Planet | 3,396,190 | 169.89 | 3,389.5 | 3.721 |
| Mercury | Planet | 2,439,700 | ∞ (sphere) | 2,439.7 | 3.700 |
| Ceres | Asteroid | 476,200 | ∞ (sphere) | 476.2 | 0.280 |
| Vesta | Asteroid | 262,700 | ∞ (sphere) | 262.7 | 0.250 |
| Titan | Moon | 2,574,730 | ∞ (sphere) | 2,574.7 | 1.352 |

Bodies with infinite inverse flattening are modeled as perfect spheres. Mars has measurable oblateness (1/169.89) and uses an oblate ellipsoid.

---

**Ellipsoid and Tile Metrics**

Each body's `Ellipsoid` is passed to the `EPSG3857` tile metrics class, which adapts the Web Mercator projection to the body's geometry:

```typescript
// Earth (default)
const earthMetrics = new EPSG3857();

// Moon — uses lunar radius for ground resolution and extent
const moonMetrics = new EPSG3857({ maxLOD: 7 }, SolarSystemBodies.Moon.ellipsoid);

// Mars — uses Martian semi-major axis
const marsMetrics = new EPSG3857({ maxLOD: 7 }, SolarSystemBodies.Mars.ellipsoid);
```

The `EPSG3857` class uses the ellipsoid's `semiMajorAxis` to compute:
- **Ground resolution** — meters per pixel at a given latitude and zoom level
- **Map extent** — the total Web Mercator extent (`2 × π × R`) for bbox calculations
- **Tile-to-geographic coordinate** conversions

This means that all standard tile operations (pan, zoom, tile selection, coordinate projection) automatically scale to the body's actual dimensions.

---

**Tile Vendors by Body**

Each planetary body has a dedicated vendor class providing pre-configured tile client factories:

### Earth

| Client | Source | Method |
|--------|--------|--------|
| Street | Google Maps | `Google.StreetClient2d()` |
| Satellite | Google Maps | `Google.SatelliteClient2d()` |
| Hybrid | Google Maps | `Google.HybridClient2d()` |
| Terrain | Google Maps | `Google.TerrainClient2d()` |
| Elevation (DEM) | MapZen Terrarium | `MapZen.ElevationsClient()` |
| DEM (elev + normals) | MapZen Terrarium | `MapZen.DemClient()` |

### Moon

| Client | Source | Method |
|--------|--------|--------|
| Basemap | OpenPlanetary / Carto CDN | `Moon.BasemapClient()` |
| Hillshade + Albedo | OpenPlanetary / S3 | `Moon.HillshadeClient()` |
| Elevation (DEM) | NASA Trek LOLA | `Moon.ElevationsClient()` |
| DEM (elev + normals) | NASA Trek LOLA | `Moon.DemClient()` |

### Mars

| Client | Source | Method |
|--------|--------|--------|
| Basemap | OpenPlanetary / Carto CDN | `Mars.BasemapClient()` |
| MOLA Color | WhereOnMars / S3 | `Mars.MOLAColorClient()` |
| MOLA Gray | WhereOnMars / S3 | `Mars.MOLAGrayClient()` |
| Surface | WhereOnMars / S3 | `Mars.SurfaceClient()` |
| Elevation (DEM) | NASA Trek MOLA | `Mars.ElevationsClient()` |
| DEM (elev + normals) | NASA Trek MOLA | `Mars.DemClient()` |

### Mercury

| Client | Source | Method |
|--------|--------|--------|
| Basemap | NASA Trek / MESSENGER MDIS | `Mercury.BasemapClient()` |

---

**Usage**

All vendor clients follow the same interface (`ITileClient<T>`) used throughout the tile pipeline. Switching between bodies is a matter of swapping the client factory:

```typescript
import { Google, Moon, Mars, Mercury, MapZen } from "spacexr";

// Image tile clients
const earthLayer  = Google.SatelliteClient2d();
const moonLayer   = Moon.BasemapClient();
const marsLayer   = Mars.MOLAColorClient();

// DEM clients
const earthDem = MapZen.DemClient();
const moonDem  = Moon.DemClient();
const marsDem  = Mars.DemClient();
```

All clients can be passed directly to `TileMapLayer`, `TileContentProvider`, or any other pipeline component that accepts `ITileClient<T>`.

---

**Adding a New Body**

To add tile support for a new planetary body:

1. **Define the body** in `space/space.bodies.ts`:
   ```typescript
   Europa: {
       name: "Europa",
       celestialType: CelestialNodeType.MOON,
       ellipsoid: Ellipsoid.FromAAndInverseF("Europa", 1560800, Infinity),
       meanRadiusKm: 1560.8,
       surfaceGravity: 1.314,
   },
   ```

2. **Create a vendor** in `tiles/vendors/tiles.vendors.europa.ts`:
   ```typescript
   export class Europa {
       public static Metrics = new EPSG3857({ maxLOD: 5 }, SolarSystemBodies.Europa.ellipsoid);
       public static BasemapClient(options?: WebClientOptions) {
           return new TileWebClient("europa_basemap", urlBuilder, new ImageTileCodec(), Europa.Metrics, options);
       }
   }
   ```

3. **Export** from `tiles/vendors/index.ts`.

The pipeline, projection math, and rendering will all work without modification — the `EPSG3857` class automatically adapts to the new ellipsoid dimensions.

---

**Data Sources and Attribution**

| Provider | Bodies | Data |
|----------|--------|------|
| OpenPlanetary | Moon, Mars | Basemap tiles, hillshade, MOLA color/gray |
| NASA Trek | Moon, Mars, Mercury | ArcGIS ImageServer (DEM, mosaics) |
| USGS | Moon, Mars, Mercury | Underlying instrument data (LOLA, MOLA, MESSENGER MDIS) |
| Google | Earth | Street, satellite, hybrid, terrain imagery |
| MapZen (AWS) | Earth | Terrarium elevation tiles |

All planetary tile data is freely available and served via public CDN or ArcGIS ImageServer endpoints.
