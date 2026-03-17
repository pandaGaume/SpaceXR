### IMAGE TILE CLIENT

SpaceXR provides two distinct tile client implementations for fetching image tiles. Both implement the `ITileClient<T>` interface and are fully interchangeable within the tile pipeline. The choice between them depends on the CORS policy of the tile server.

---

**The CORS Problem**

Web browsers enforce the Same-Origin Policy, which restricts JavaScript from reading responses from cross-origin servers unless the server explicitly permits it via `Access-Control-Allow-Origin` headers. The standard `fetch()` API is subject to this restriction.

Many tile servers — particularly raw S3 buckets hosting open data (OpenPlanetary, WhereOnMars) — do not configure CORS headers. Requests via `fetch()` will fail:

```
Access to fetch at 'https://s3.amazonaws.com/opmbuilder/...' from origin 'http://localhost'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

However, the HTML `<img>` element loads images via a different mechanism that is **exempt from CORS restrictions**. An `<img>` element can display any image from any origin — it has always worked this way on the web.

---

**Two Client Implementations**

### 1. `TileWebClient<T>` — Standard fetch-based client

The primary tile client. Uses the `fetch()` API to download tile data, then passes the `Response` to a codec for decoding.

```
TileWebClient → fetch(url) → Response → ICodec.decodeAsync(response) → T
```

**Capabilities:**
- Supports any codec (`ImageTileCodec`, `Float32TileCodec`, `RGBTileCodec`, etc.)
- Can decode to `HTMLImageElement`, `Float32Array`, `Uint8ClampedArray`, `ImageData`, etc.
- Supports pixel-level data access (elevation decoding, normal map generation)
- Requires the server to send CORS headers

**Use when:** The tile server supports CORS (Google, Carto CDN, NASA Trek ArcGIS, MapZen/AWS with CORS configured).

```typescript
import { TileWebClient } from "spacexr";

const client = new TileWebClient("my_tiles", urlBuilder, new ImageTileCodec(), metrics);
```

### 2. `ImageTileClient` — CORS-bypass client via `<img>` element

An alternative client that loads tiles by setting `img.src = url` on an `HTMLImageElement`. This bypasses CORS entirely.

```
ImageTileClient → new Image() → img.src = url → onload → HTMLImageElement
```

**Capabilities:**
- Loads images from any server, regardless of CORS policy
- Returns `HTMLImageElement` directly (no codec needed)
- Supports retry with exponential backoff (same as `TileWebClient`)
- Validates tile addresses against metrics before loading

**Limitations:**
- Output type is always `HTMLImageElement` — no pixel-level decoding
- The loaded image will taint the canvas (`getImageData()` / `toBlob()` will throw)
- Cannot be used for elevation or normal map decoding (use `TileWebClient` for DEM)

**Use when:** The tile server does **not** send CORS headers (raw S3 buckets, some legacy tile servers).

```typescript
import { ImageTileClient } from "spacexr";

const client = new ImageTileClient("my_tiles", urlBuilder, metrics);
```

---

**Decision Matrix**

| Server CORS | Need pixel data? | Client to use |
|:-----------:|:----------------:|:-------------|
| Yes | Yes | `TileWebClient` with `Float32TileCodec` / `RGBTileCodec` |
| Yes | No | `TileWebClient` with `ImageTileCodec` |
| No | No | `ImageTileClient` |
| No | Yes | Not possible client-side — use a CORS proxy or server-side relay |

---

**TMS Y-Axis Convention**

Some tile servers store tiles in the TMS (Tile Map Service) convention where Y=0 is at the **bottom** (south), while the standard XYZ/slippy-map convention has Y=0 at the **top** (north). Both clients work with the `WebTileUrlBuilder`, which supports automatic Y-flipping:

```typescript
const urlBuilder = new WebTileUrlBuilder()
    .withSecure(true)
    .withHost("s3.amazonaws.com")
    .withPath("tiles/{z}/{x}/{y}.{extension}")
    .withExtension("png")
    .withTMSY(true);  // ← flips Y: y_tms = (2^z - 1) - y_xyz
```

Without `withTMSY(true)`, tiles from TMS servers will appear **upside down**.

---

**Architecture**

Both clients share the same external interface:

```typescript
interface ITileClient<T> {
    name: string;
    metrics: ITileMetrics;
    fetchAsync(request: ITile2DAddress, env?: IGeoBounded, ...userArgs: unknown[]): Promise<FetchResult<ITile2DAddress, Nullable<T>>>;
}
```

This means they are fully interchangeable in the pipeline. A `TileContentProvider`, `TileMapLayer`, or any other component that accepts `ITileClient<T>` will work identically with either implementation.

```
┌──────────────────┐          ┌──────────────────────┐
│  TileWebClient   │          │   ImageTileClient    │
│  (fetch API)     │          │   (<img> element)    │
├──────────────────┤          ├──────────────────────┤
│ + ICodec<T>      │          │ (no codec needed)    │
│ + IUrlBuilder    │          │ + IUrlBuilder        │
│ + ITileMetrics   │          │ + ITileMetrics       │
│ + WebClientOpts  │          │ + WebClientOpts      │
└────────┬─────────┘          └──────────┬───────────┘
         │                               │
         └───────────┬───────────────────┘
                     │
              ITileClient<T>
                     │
         ┌───────────┴───────────────┐
         │   TileContentProvider     │
         │   TileMapLayer            │
         │   ... (any consumer)      │
         └───────────────────────────┘
```

---

**Retry and Error Handling**

Both clients support retry with exponential backoff, configurable via `WebClientOptions`:

```typescript
const options: WebClientOptions = {
    maxRetry: 3,          // Maximum number of attempts
    initialDelay: 1000,   // Initial delay in ms before first retry
};

const client = new ImageTileClient("tiles", urlBuilder, metrics, options);
```

On each retry, the delay doubles with random jitter, capped at 30 seconds. If all retries are exhausted, a `FetchError` is thrown.

---

**Vendor Usage Patterns**

The vendor classes abstract the client choice. Servers with CORS use `TileWebClient`; servers without CORS use `ImageTileClient`:

```typescript
// Carto CDN — supports CORS → TileWebClient
Moon.BasemapClient()    // → TileWebClient + ImageTileCodec

// Raw S3 — no CORS → ImageTileClient
Moon.HillshadeClient()  // → ImageTileClient (loads via <img>)

// NASA Trek ArcGIS — supports CORS → TileWebClient
Moon.ElevationsClient() // → TileWebClient + Float32TileCodec (needs pixel access)
```

The consumer does not need to know which client is used — both return `FetchResult<ITile2DAddress, Nullable<T>>` and integrate identically into the pipeline.
