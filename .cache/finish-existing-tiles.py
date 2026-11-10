from pathlib import Path
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
p=r/'examples/babylon-earth/src/main.ts';s=p.read_text(encoding='utf-8').replace('const demEnabled = query.get("dem") === "1" || (inside && query.get("dem") !== "0");','const demEnabled = query.get("dem") !== "0";');p.write_text(s,encoding='utf-8')
p=r/'examples/babylon-earth/README.md';p.write_text('''# Earth: orbital and inside-atmosphere examples

From spacexr-rendering, run `npm run framework:install`, `npm run framework:build`, then `npm run example:earth`. Both `orbital.html` and `atmosphere.html` use the public `@spacexr/babylon-earth` composition and the existing terrain, raster and 3D Tiles components.

## Existing tile sources

Both entries use `createMapzenTerrariumSource`, `DemPyramid`, `ChildHeightRanges`, the existing DEM workers and `TERRAIN_CONFIG` from the working Mapzen example. The same TileRuntime instance selects terrain and imagery residency in the Earth composition. There is no manual global-image reprojection and no extra imagery runtime.

Imagery uses `loadLocalImagery` from `babylon-implicit-grid-mapzen`, with the existing configured local provider selected by `?imagery=google` by default. That provider already uses `WebTileSource`, `WebMercatorTileMetrics` and `BrowserImageDecoder`. Its decoded tiles feed the existing `BabylonRasterPages` and stitched `RasterPyramid`. The local provider module stays in the original sample's ignored `src/local/` directory; it is not copied or published by babylon-earth. On another machine, configure that existing local provider module as documented by the Mapzen sample, or use `?imagery=none`. The reusable Earth library receives imagery through `terrain.imagery` and has no hardcoded provider.

`?dem=0` explicitly disables DEM loading. `?imagery=none` explicitly disables imagery. Network access is required for the configured sources. Attribution follows the provider and Mapzen/AWS source.

## Views and controls

- `/orbital.html` opens the whole Earth.
- `/orbital.html?view=horizon&sse=20` opens a grazing orbital view.
- `/orbital.html?view=horizon&sunset=1&sse=20` computes a geometric orbital sunset using Celestial.
- `/atmosphere.html?hour=10&sse=20` reproduces the daytime terrain view at 10:00 UTC.
- `/atmosphere.html?sunset=1&sse=20` opens the Mapzen sunset view.

Drag to navigate and use the wheel to zoom. The UTC slider changes Celestial sunlight; the checkbox compares atmosphere on the same scene. Exposure defaults to 4, consistently at startup and after date changes. The fixed demonstration date is 2026-06-21. `hour` accepts values from 0 to 24.

SSE defaults to 20 pixels and remains configurable with `?sse=24`. The sample uses one render pixel per CSS pixel by default; `?dpr=1.5` or `?dpr=2` opts into higher resolution, and `?dpr=0.75` reduces it.

## Atmospheric composition

WebGPU combines scene-linear color and the actual depth attachment produced by the displaced terrain draw. The existing atmospheric volume uses a continuous distance coordinate across the reference ellipsoid's horizon. Ground intersections stop transport without rescaling neighboring rays. This prevents a horizontal atmospheric cut through foreground mountains. The backend owns spectral transport; the Babylon compositor reconstructs distance and samples its result. The camera-volume change does not alter tile selection or add a terrain renderer.

Earth includes a documented reference ozone column and an isotropic higher-order scattering approximation. See [the library contract](../../packages/babylon-earth/README.md) for limitations, resource ownership and integration into another application. The WebGL terrain variant is `/orbital.html?renderer=webgl&atmosphere=0`.
''',encoding='utf-8')
