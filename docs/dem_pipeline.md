### DEM PIPELINE

Digital Elevation Model (DEM) support in SpaceXR enables terrain visualization for Earth and planetary bodies. The DEM pipeline builds on top of the standard tile pipeline, adding elevation decoding and normal map computation. This document covers the architecture, data sources, and usage patterns for elevation tile support across all supported bodies.

---

**Overview**

A DEM tile contains two datasets for each tile address:

1. **Elevations** — a `Float32Array` of height values in meters, one per pixel (e.g., 256×256 = 65,536 values)
2. **Normals** — a `Uint8ClampedArray` of encoded surface normal vectors (RGB per pixel), used for lighting

The `DemTileWebClient` combines these into an `IDemInfos` object:

```typescript
interface IDemInfos {
    elevations: Float32Array;   // height values in meters
    normals: Uint8ClampedArray; // encoded normal vectors (R, G, B per pixel)
    min: ICartesian3;           // minimum elevation bounds
    max: ICartesian3;           // maximum elevation bounds
    delta: number;              // elevation range (max - min)
    mean: number;               // mean elevation
}
```

---

**Pipeline Architecture**

```
                    ┌─────────────────────────┐
                    │    DemTileWebClient      │
                    │    ITileClient<IDemInfos>│
                    └────────┬────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐  (optional)  ┌──────▼────────────┐
    │ Elevation Src  │              │   Normal Src      │
    │ ITileClient    │              │   ITileClient     │
    │ <Float32Array> │              │ <Uint8ClampedArray>│
    └─────────┬──────┘              └──────┬────────────┘
              │                            │
    ┌─────────▼──────┐              ┌──────▼────────────┐
    │ TileWebClient  │              │  TileWebClient    │
    │ + Float32Codec │              │  + RGBTileCodec   │
    │ + IPixelDecoder│              │                   │
    └─────────┬──────┘              └──────┬────────────┘
              │                            │
    ┌─────────▼──────┐              ┌──────▼────────────┐
    │  URL Builder   │              │  URL Builder      │
    │  (vendor)      │              │  (vendor)         │
    └────────────────┘              └───────────────────┘
```

If no normal source is provided, `DemTileWebClient` automatically **computes normals from elevations** using cross-product averaging over a 3×3 neighborhood window. This is the default for all planetary DEM clients (Moon, Mars), since the NASA Trek endpoints only provide elevation data.

---

**Elevation Decoding**

Raw tile images (PNG) must be decoded into floating-point elevation values. This is done by an `IPixelDecoder<Float32Array>` that reads RGBA pixel data and outputs meters:

```typescript
interface IPixelDecoder<T> {
    decode(pixels: Uint8ClampedArray, offset: number, target: T, targetOffset: number): number;
}
```

SpaceXR provides two decoders:

### 1. MapZen Terrarium Decoder (Earth)

Used for MapZen/AWS Terrarium tiles. Each pixel encodes elevation in 3 channels:

```
elevation = R × 256 + G + B / 256 − 32768
```

- **Precision:** sub-meter (~1/256 m)
- **Range:** −32,768 m to +32,767 m
- **Source:** `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`

```typescript
class MapzenAltitudeDecoder implements IPixelDecoder<Float32Array> {
    decode(pixels, offset, target, targetOffset) {
        const r = pixels[offset], g = pixels[offset+1], b = pixels[offset+2];
        target[targetOffset++] = r * 256 + g + b / 256 - 32768;
        return targetOffset;
    }
}
```

### 2. ArcGIS Grayscale Decoder (Moon, Mars)

Used for NASA Trek ArcGIS ImageServer tiles. The server renders elevation as 8-bit grayscale PNG, linearly stretched from an elevation range [min, max] to [0, 255]:

```
elevation = min + (gray / 255) × (max − min)
```

- **Precision:** `(max − min) / 255` meters per step
- **Source:** ArcGIS ImageServer `exportImage` endpoint

| Body | Decoder | Min (m) | Max (m) | Step (m) | Source |
|------|---------|--------:|--------:|---------:|--------|
| Moon | ArcGIS Grayscale | −9,128 | +10,786 | ~78.1 | LRO LOLA DEM 256 ppd |
| Mars | ArcGIS Grayscale | −8,201 | +21,241 | ~115.5 | MOLA 128/64 ppd merge |

```typescript
class ArcGISGrayscaleElevationDecoder implements IPixelDecoder<Float32Array> {
    constructor(min: number, max: number) { /* ... */ }

    decode(pixels, offset, target, targetOffset) {
        const gray = pixels[offset];
        target[targetOffset++] = this._min + (gray / 255) * this._range;
        return targetOffset;
    }
}
```

The precision is lower than Terrarium encoding (78–115 m per step vs. sub-meter), but sufficient for global-scale visualization and is the standard format served by NASA Trek.

---

**ArcGIS ImageServer URL Builder**

The `ArcGISImageServerUrlBuilder` converts tile XYZ addresses to bbox-based `exportImage` URLs, which is the standard access method for ArcGIS ImageServer raster services.

**Bbox calculation from tile XYZ:**

Given a tile at position (x, y) at zoom level z, and a body with semi-major axis R:

```
extent   = π × R                         (half the Web Mercator extent)
tileSpan = 2 × extent / 2^z              (span of one tile in meters)
xmin     = −extent + x × tileSpan
ymax     =  extent − y × tileSpan
xmax     = xmin + tileSpan
ymin     = ymax − tileSpan
```

**Generated URL format:**

```
{baseUrl}?bbox={xmin},{ymin},{xmax},{ymax}&bboxSR=3857&imageSR=3857&size=256,256&format=png&f=image
```

The builder automatically uses the correct ellipsoid semi-major axis for the body, ensuring the projected extent matches the body's actual dimensions:

```typescript
// Moon — R = 1,738,100 m → extent = π × 1,738,100 ≈ 5,461,196 m
const moonUrl = new ArcGISImageServerUrlBuilder(
    "https://trek.nasa.gov/moon/.../ImageServer/exportImage",
    SolarSystemBodies.Moon.ellipsoid.semiMajorAxis
);

// Mars — R = 3,396,190 m → extent = π × 3,396,190 ≈ 10,668,382 m
const marsUrl = new ArcGISImageServerUrlBuilder(
    "https://trek.nasa.gov/mars/.../ImageServer/exportImage",
    SolarSystemBodies.Mars.ellipsoid.semiMajorAxis
);
```

---

**Normal Map Computation**

When no pre-rendered normal map source is available (the case for Moon and Mars DEM), `DemTileWebClient` computes normals from the elevation grid using the following algorithm:

1. For each pixel, examine a 3×3 neighborhood window
2. Compute cross products between adjacent neighbor vectors (8 neighbors, cyclic)
3. Average the resulting normal vectors
4. Normalize and encode into RGB:
   - `R = (nx + 1) / 2 × 255`
   - `G = (ny + 1) / 2 × 255`
   - `B = nz × 127 + 128`

This produces a standard tangent-space normal map compatible with GPU lighting shaders. The precision is limited to 1/255 per component (~0.4° angular precision).

---

**Data Sources**

### Earth — MapZen Terrarium

| Property | Value |
|----------|-------|
| Provider | MapZen (hosted on AWS S3) |
| Format | PNG, RGB-encoded elevation |
| Max LOD | 15 |
| Tile Size | 256×256 |
| Coverage | Global |
| Normal Maps | Pre-rendered on separate endpoint |
| URL Pattern | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` |

### Moon — LRO LOLA DEM

| Property | Value |
|----------|-------|
| Provider | NASA Trek (ArcGIS ImageServer) |
| Instrument | Lunar Reconnaissance Orbiter — LOLA |
| Format | PNG, 8-bit grayscale |
| Resolution | 256 pixels per degree |
| Max LOD | 7 |
| Elevation Range | −9,128 m to +10,786 m |
| Coverage | Global |
| CORS | Supported (`Access-Control-Allow-Origin: *`) |
| Endpoint | `https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer/exportImage` |

### Mars — MOLA DEM

| Property | Value |
|----------|-------|
| Provider | NASA Trek (ArcGIS ImageServer) |
| Instrument | Mars Global Surveyor — MOLA |
| Format | PNG, 8-bit grayscale |
| Resolution | 128/64 pixels per degree (merged) |
| Max LOD | 7 |
| Elevation Range | −8,201 m to +21,241 m |
| Coverage | Global (90°N to 90°S) |
| CORS | Supported (reflects origin) |
| Endpoint | `https://trek.nasa.gov/mars/trekarcgis/rest/services/mola128_mola64_merge_90Nto90S_SimpleC_clon0/ImageServer/exportImage` |

---

**Usage**

### Quick Start

```typescript
import { MapZen, Moon, Mars } from "spacexr";

// Earth DEM — elevations + pre-rendered normals
const earthDem = MapZen.DemClient();

// Moon DEM — LOLA elevations + computed normals
const moonDem = Moon.DemClient();

// Mars DEM — MOLA elevations + computed normals
const marsDem = Mars.DemClient();
```

### Elevations Only

If you only need height values (no normals), use the `ElevationsClient()` directly:

```typescript
// Returns ITileClient<Float32Array>
const moonElevations = Moon.ElevationsClient();
const marsElevations = Mars.ElevationsClient();

const result = await moonElevations.fetchAsync(tileAddress);
const heights: Float32Array = result.content; // 256×256 elevation values in meters
```

### With Elevation Filter

Pass a custom filter via `WebClientOptions` to post-process elevation data (e.g., smoothing, clamping):

```typescript
const filteredElevations = Moon.ElevationsClient({ filter: myElevationFilter });
```

The filter implements `IFilter<Float32Array>` and is applied after pixel decoding.

---

**Adding DEM Support for a New Body**

To add DEM support for a new planetary body:

1. **Find the ArcGIS ImageServer endpoint** on NASA Trek (or another ArcGIS service). Verify CORS support:
   ```bash
   curl -I "https://trek.nasa.gov/.../ImageServer/exportImage?bbox=...&f=image" \
        -H "Origin: http://localhost"
   # Look for: Access-Control-Allow-Origin
   ```

2. **Determine the elevation range** from the ImageServer metadata:
   ```
   https://trek.nasa.gov/.../ImageServer?f=json
   ```
   Look for `minValues` and `maxValues` in the response.

3. **Add to the vendor class:**
   ```typescript
   export class MyBody {
       private static readonly ELEV_MIN = -1000;
       private static readonly ELEV_MAX = 5000;
       private static readonly DEM_URL = "https://trek.nasa.gov/.../ImageServer/exportImage";

       public static ElevationsClient(options?: WebClientOptions) {
           const url = new ArcGISImageServerUrlBuilder(MyBody.DEM_URL, SolarSystemBodies.MyBody.ellipsoid.semiMajorAxis);
           const decoder = new ArcGISGrayscaleElevationDecoder(MyBody.ELEV_MIN, MyBody.ELEV_MAX);
           return new TileWebClient("mybody_dem", url, new Float32TileCodec(decoder), MyBody.Metrics, options);
       }

       public static DemClient(options?: WebClientOptions) {
           return new DemTileWebClient("mybody_dem", MyBody.ElevationsClient(options));
       }
   }
   ```

4. Normals will be **computed automatically** from elevations by `DemTileWebClient`.

---

**Comparison of Encoding Schemes**

| Scheme | Channels | Precision | Range | Used By |
|--------|:--------:|----------:|------:|---------|
| Terrarium (RGB) | 3 | ~0.004 m | ±32,768 m | MapZen (Earth) |
| ArcGIS Grayscale | 1 | ~78–116 m | body-specific | NASA Trek (Moon, Mars) |
| Mapbox Terrain RGB | 3 | 0.1 m | −10,000 to +1,838,553 m | Mapbox (Earth) |

The ArcGIS grayscale encoding is lossier but universally available through NASA Trek for any planetary body with DEM data. For higher-precision needs, raw Float32 or Int16 raster data can be accessed through the same ArcGIS endpoints using `pixelType` parameters (future enhancement).
