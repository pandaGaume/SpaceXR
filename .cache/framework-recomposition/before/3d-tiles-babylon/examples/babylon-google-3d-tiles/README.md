<img src="https://raw.githubusercontent.com/pandaGaume/3d-tiles-core/main/assets/brand/spacexr-component.png" alt="SpaceXR Component" height="56">

# Babylon.js and Google Photorealistic 3D Tiles

This example connects Babylon.js to Google Photorealistic 3D Tiles through `@spacexr/3d-tiles-runtime` and `@spacexr/3d-tiles-babylon`. Only the Google-specific parts live here: the session-preserving URI resolver, the API key proxy and the redacted request errors.

It demonstrates:

- authenticated root and child resource resolution while preserving Google's `session` parameter;
- external tileset traversal and GLB loading;
- WGS84 ECEF traversal and rendering with Babylon.js 9 `GeospatialCamera`;
- large-world floating-origin rendering for Earth-scale coordinates;
- frustum, horizon and local-area culling;
- renderer attachment, detachment and cache disposal;
- camera rotation without reloading, with the navigation defaults of the runtime; the example only sets its memory budgets;
- real-time runtime statistics;
- aggregation of the copyright fields from every displayed GLB tile.

## Google Cloud setup

The Google project must have billing enabled and the Map Tiles API activated. Create an API key restricted to the Map Tiles API and to the HTTP referrers used by this example, such as `http://localhost:5173/*` during local development.

Google's documentation:

- [Photorealistic 3D Tiles](https://developers.google.com/maps/documentation/tile/3d-tiles)
- [Build a custom 3D Tiles renderer](https://developers.google.com/maps/documentation/tile/create-renderer)
- [Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies)

## Local environment

Copy the example environment template:

```powershell
cd examples\babylon-google-3d-tiles
Copy-Item .env.example .env
```

Then put the restricted key in the untracked `.env` file:

```dotenv
GOOGLE_MAP_TILES_API_KEY=your_restricted_key
```

The filename must be exactly `.env`, not `.envc`. Stop and restart the Vite development server after creating or changing this file because environment files are read when Vite starts.

The API key deliberately has no `VITE_` prefix. It remains on the server and is added only by the local Vite proxy when requests are forwarded to Google. It is not embedded in `dist` and is never sent to the application as configuration. Never commit `.env`.

The included proxy supports local development and local production previews. A deployed static site cannot keep an API key secret. Production deployment therefore requires an equivalent same-origin backend proxy, with authentication, request validation, rate limiting and a Google API key restricted to the backend environment.

The starting location and navigation envelope can also be changed in `.env`. The defaults open Paris with a 100 km coarse clipping radius.

## Run

From the repository root, after building 3d-tiles-core as described in the [repository README](../../README.md):

```powershell
npm install
npm run example:google-3d-tiles
```

To test the production build locally:

```powershell
npm run build --workspace @spacexr/example-babylon-google-3d-tiles
npm run example:google-3d-tiles:preview
```

The preview server reads `GOOGLE_MAP_TILES_API_KEY` from `.env` when it starts and activates the Google Tiles proxy. It serves the existing `dist` directory without rebuilding it, and the generated browser bundle does not contain the key.

Run these commands from the repository root, where the npm workspace `package.json` is located.

The example renders with WebGL. Add `?renderer=webgpu` to the page URL to run it on the WebGPU engine of Babylon.js where the browser supports it. It falls back to WebGL otherwise and shows what it runs on in its status line.

## Coordinate frames

The runtime and Babylon scene both use WGS84 ECEF metres. The Babylon.js 9 `GeospatialCamera` navigates the globe directly, while `useLargeWorldRendering` keeps CPU matrix calculations precise and applies a floating origin before values reach the GPU.

```text
Google 3D Tiles local coordinates
              |
              v
      tile local-to-ECEF transform
              |
              v
Babylon right-handed ECEF world + GeospatialCamera
```

The Babylon scene uses a right-handed coordinate system. Every tile receives its exact composed local-to-ECEF 3D Tiles transform through a Babylon pre-transform matrix. `@spacexr/geodesy` converts the initial latitude, longitude and ellipsoidal height to EPSG:4978-compatible ECEF coordinates, and supplies the WGS84 ellipsoid surface normal used by the camera.

Controls use Babylon.js 9 defaults: left-drag pans the globe, right-drag changes yaw and pitch, the wheel zooms, and a double click flies toward the selected point.

## Attribution and caching

The attribution footer is part of the example, not optional decoration. It displays `Google Maps` and aggregates the `asset.copyright` values from GLB tiles currently attached to the scene.

The example uses only bounded, transient in-memory runtime caching for interactive visualization. It does not install a service worker, persist Google tile responses or provide offline access. Production applications remain responsible for complying with the current Google Maps Platform terms and Map Tiles API policies.
