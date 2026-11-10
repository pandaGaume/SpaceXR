from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
def write(path,text):
    assert '\u2014' not in text
    (root/path).write_text(text,encoding='utf-8')
write('packages/babylon-earth/README.md','''# @spacexr/babylon-earth

Optional Earth composition for an existing Babylon scene. Celestial owns Earth shape and gravity. The generic SpaceXR TileRuntime selects the implicit terrain and its imagery in one shared cut. The public `@spacexr/atmosphere/webgpu` backend owns spectral scattering and LUT construction. The atmosphere bridge is internal to this package; no separate babylon-atmosphere package is introduced.

## Local setup

From the rendering repository run `npm run framework:install`, then `npm run framework:build`. Keep sibling repositories 3d-tiles-core, terrain-core, quantia, celestial-core and spacexr-atmosphere alongside rendering. Nothing has been published. Celestial and Quantia currently have private package metadata, so use the local workspace rather than assuming registry availability.

## Integration

```ts
import { createGeospatialRendererEngine, createGeospatialScene } from "@spacexr/3d-tiles-babylon";
import { createEarthRuntime } from "@spacexr/babylon-earth";

const { engine } = await createGeospatialRendererEngine(canvas, "webgpu");
const scene = createGeospatialScene(engine);
const earth = await createEarthRuntime(scene, {
    date: new Date("2026-06-21T12:00:00Z"),
    camera: {
        target: { latitudeDegrees: 25, longitudeDegrees: 0 },
        radius: 12_000_000,
        pitchRadians: 0,
    },
    // terrain: { elevation: { pyramid: yourDemPyramid }, imagery: yourRasterPagesOptions },
});
let stopped = false;
async function frame() {
    if (stopped) return;
    await earth.update();
    if (stopped) return;
    engine.beginFrame();
    scene.render(false);
    engine.endFrame();
    requestAnimationFrame(() => void frame());
}
requestAnimationFrame(() => void frame());

// On application teardown:
// stopped = true;
// await earth.dispose();
// scene.dispose(); engine.dispose();
```

The library creates no canvas, engine or render loop. Call `update` before beginning a Babylon frame, outside any open engine render pass. It owns its created camera, lights, terrain, imagery pages, sky resources and labels. It borrows the scene, engine, optional existingCamera, supplied DEM and label layer. Await `dispose()` before destroying the scene or engine. It restores the previous active camera if its camera is still active. There is one actual TileRuntime instance, exposed as `earth.runtime`, and no independent imagery selector.

`setDate(date)` resolves Celestial geometric Sun direction and replaces the immutable atmosphere snapshot. `setAtmosphereEnabled(boolean)` changes visibility. `setExposure(number)` changes display exposure. `atmosphereReady` means a completed sky snapshot is available. Runtime errors can be observed through `onError` and the underlying runtime events.

## Rendering contract and scope

Atmosphere requires Babylon WebGPU. WebGL terrain works with `atmosphere: false`; an atmospheric request on WebGL fails explicitly. The bridge is qualified against Babylon 9.33.x. Babylon exposes no public GPU-device getter in that version: the `_device` access and external-texture hardware view initialization are isolated in `src/atmosphere/babylon-sky.ts`. Upgrade that bridge and rerun browser qualification when changing Babylon versions.

Sky and orbital limb use the existing single-scattering spectral backend with 24 wavelengths by default. Its analytic layer limits and numerical domain still apply. This first integration draws a background sky; it does not add depth-based aerial perspective, cloud rendering, multiple scattering or terrain shadows from atmosphere. Terrain lighting follows the same Celestial Sun direction. The shader in this package only samples the public sky reader and applies exposure/display encoding; it contains no scattering model.

Translation builds a new sky snapshot progressively. The previous completed image stays visible while construction finishes. Continuous-motion XR accuracy/performance is not qualified. `quality`, output `width` and `dispatchesPerFrame` tune this cost. The camera must be unparented, perspective, symmetric, full viewport and above the physical ellipsoid. ECEF metres and a right-handed scene are required. Device loss is reported; automatic engine/device recreation belongs to the application.

Mercator terrain stops at approximately 85.05 degrees latitude. Static sea-level polar placeholders close the globe by default, using the Celestial ellipsoid. They are not polar imagery or DEM data. Set `polarCaps: false` to hide them. There is no cube implementation.

## Examples

Two separate HTML/TypeScript entry points are provided in [the Earth sample](../../examples/babylon-earth/README.md): orbital and inside the atmosphere. Both use this package. For consumption from another local project, extend [the framework dependency setup](../../docs/consume-framework.md) with this package and the Celestial/Atmosphere links, then import its public API.
''')
write('examples/babylon-earth/README.md','''# Earth: orbital and inside-atmosphere examples

From spacexr-rendering:

```sh
npm run framework:install
npm run framework:build
npm run example:earth
```

Open [the orbital example](http://127.0.0.1:5180/orbital.html) or [the inside-atmosphere example](http://127.0.0.1:5180/atmosphere.html). Separate convenience commands are `npm run example:earth:orbit` and `npm run example:earth:atmosphere`. They start the same development server and open the selected page; run one server at a time.

| Entry | Initial view | Data |
| --- | --- | --- |
| orbital.html, src/orbital.ts | Whole Earth, camera well outside the atmosphere | Bundled visual imagery reprojected into implicit Mercator tiles; no tile-provider credentials |
| atmosphere.html, src/atmospheric.ts | Mont Blanc and a visible horizon, camera inside the atmosphere | Actual Terrarium DEM tiles from Mapzen/AWS Open Data; network required, no API key |

The two entry points share setup code in src/main.ts and the public `@spacexr/babylon-earth` library. They do not duplicate the tile runtime. Production `npm run build --workspace @spacexr/example-babylon-earth` outputs both pages as well as index.html.

Drag and zoom with the camera controls. UTC hour changes the Celestial Sun direction and physical sky snapshot. The atmosphere checkbox and exposure slider allow comparison. Rendering errors appear in the status area and console. A frozen date, 2026-06-21, makes the initial illumination reproducible; this is a demonstration date, not a live astronomy clock.

The atmosphere uses WebGPU. The explicit WebGL terrain-only variant is `/orbital.html?renderer=webgl&atmosphere=0`. A browser lacking WebGPU receives a clear message when atmosphere is requested. For an inside-atmosphere view without external DEM requests, use `/atmosphere.html?dem=0`, which shows a sea-level surface without relief. Atmosphere computation and orbital imagery stay local after dependencies are installed.

The local Earth image is a legacy visual asset whose original provenance and registration have not been qualified. It is not high-resolution terrain imagery and becomes blurred at close range. DEM attribution: Terrain Tiles by Mapzen, hosted by AWS Open Data; see [source attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). No production provider is hardcoded in the library. Polar caps are sea-level placeholders, not measured polar terrain.

The first delivery includes spectral sky and limb, not aerial perspective on terrain. See [the library contract](../../packages/babylon-earth/README.md) for ownership, camera limits, progressive construction and integration into another application.
''')
f=root/'docs/architecture.md';s=f.read_text();start=s.index('## Babylon Earth library');s=s[:start]+'''## Babylon Earth library

`packages/babylon-earth` now implements `@spacexr/babylon-earth` as an optional composition. It combines Celestial ellipsoid/gravity and Sun direction, the existing implicit terrain adapter, one existing TileRuntime instance, camera and lighting, and the public spectral AtmosphereSky WebGPU backend. The atmosphere bridge stays internal for this first delivery. Generic packages do not acquire body-specific dependencies.

The host supplies its Babylon scene and engine and retains the render loop. The facade provides update, date/exposure/visibility and asynchronous disposal. Imagery residency follows terrain readiness and presentation, without another selector. Mercator remains the terrain projection; static polar placeholders close its uncovered poles without cube APIs.

Two distinct samples demonstrate orbital and inside-atmosphere use. Sky/limb are implemented; atmospheric aerial perspective and automatic device-loss recovery remain later work. See [the library](../packages/babylon-earth/README.md) and [the samples](../examples/babylon-earth/README.md) for the exact current contract.
''';f.write_text(s)
f=root/'docs/consume-framework.md';s=f.read_text();s=s.replace('The future `@spacexr/babylon-earth` facade will encapsulate this Earth-specific assembly with atmosphere; it is currently an architectural target.','The optional `@spacexr/babylon-earth` facade now encapsulates this Earth assembly with the existing spectral WebGPU sky backend.')
s+='''
## Optional Earth composition

Add the following local dependencies alongside the generic framework dependencies listed above, using paths relative to your application:

```json
{
  "@spacexr/babylon-earth": "file:../spacexr-rendering/packages/babylon-earth",
  "@spacexr/celestial-core": "file:../celestial-core",
  "@spacexr/atmosphere": "file:../spacexr-atmosphere"
}
```

Celestial currently depends on the sibling Quantia package. Build those physical packages before Earth, or use the updated `framework:install` and `framework:build` scripts, which handle that order. Keep `install-links=false` and one Babylon installation in the application. This is a local delivery, not a registry release. The Earth library uses Babylon 9.33.x for its isolated WebGPU bridge. See [integration code](../packages/babylon-earth/README.md) and [the two examples](../examples/babylon-earth/README.md).
''';f.write_text(s)
f=root/'README.md';s=f.read_text();s+='''
## Optional Earth runtime and two examples

`@spacexr/babylon-earth` composes Celestial, the existing TileRuntime and the public spectral AtmosphereSky backend. Its Babylon atmosphere bridge remains internal. Run `npm run example:earth` and open `/orbital.html` for the globe or `/atmosphere.html` for the Mont Blanc horizon. See [the sample](examples/babylon-earth/README.md) and [the reusable library](packages/babylon-earth/README.md). Atmospheric rendering requires WebGPU; explicit WebGL terrain-only mode remains available. The framework scripts now also install/build Quantia, Celestial and Atmosphere dependencies.
''';f.write_text(s)
f=root/'AGENTS.md';s=f.read_text();s+='''
## Earth composition

The user authorized the implemented optional packages/babylon-earth composition. Keep its Babylon atmosphere bridge internal until an actual second consumer justifies extraction. Reuse @spacexr/atmosphere/webgpu AtmosphereSky; never duplicate its scattering or LUT implementation here. Keep two working sample entry points: orbital.html and atmosphere.html. State WebGPU and sky-only scope explicitly. Maintain the one TileRuntime instance and shared terrain/imagery cut in Earth. Pin and qualify the Babylon 9.33.x internal device/texture bridge when upgrading.
''';f.write_text(s)
print('Earth API, limitations and two examples documented.')
