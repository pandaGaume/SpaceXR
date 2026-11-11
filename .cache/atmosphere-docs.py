from pathlib import Path
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
def put(n,s):
 p=root/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s.lstrip('\n'),encoding='utf8')
p=root/'docs/WEBGPU-INTEGRATION.md';s=p.read_text()
s=s.replace('Status: implementation contract for milestone 1, **integrable sky**. The runtime API below is not exported yet. This document defines the first extraction from the laboratory; it does not declare the milestone complete.', 'Status: implemented runtime contract for milestone 1, **integrable sky**. The public entry is `@spacexr/atmosphere/webgpu`. Numerical qualification is case-specific and recorded by `npm run test:webgpu`; it is not an observational or performance guarantee.')
s=s.replace('The renderer will live under','The renderer lives under').replace('`IAtmosphereCamera` will contain','`IAtmosphereCamera` contains')
s=s.replace('The intended runtime surface is:', 'The runtime surface is:')
start=s.index('```ts\nconst sky = ');end=s.index('```',start+6)+3
s=s[:start]+'''```ts
const sky = await AtmosphereSky.create(device, atmosphere, options);
sky.update(camera); // CPU snapshot and invalidation only

function frame() {
    const encoder = device.createCommandEncoder();
    const ready = sky.encode(encoder); // one construction task by default
    if (ready) {
        const resources = sky.bindings();
        // Host draws with resources in a later pass on this encoder.
    }
    device.queue.submit([encoder.finish()]);
    // Schedule the next frame while ready is false.
}
// After the final submission referencing the instance:
// sky.dispose();
```'''+s[end:]
s=s.replace('`encode` requires a camera', '`encode(encoder, maxDispatches = 1)` returns a boolean indicating whether the readers are ready downstream of this encoder. It processes a bounded number of construction tasks without waiting. The dispatch budget must be an integer from 1 to 4096. Increasing it is a host decision based on measured GPU cost. Initial solar construction is progressive; subsequent translations rebuild the view table.\n\n`encode` requires a camera')
s=s.replace('each `update -> encode -> draw -> submit` sequence', 'each `update -> encode -> optional draw -> submit` sequence')
s=s.replace('Before the first successful `encode`, `bindings()` throws a clear not-ready error. After encoding it exposes resources valid for downstream reads in that submitted sequence;', 'Until `encode` returns true, `bindings()` throws a clear not-ready error, including after translation. When ready, it exposes resources valid for downstream reads in that submitted sequence;')
needle='### Invalidation'
s=s.replace(needle, '''With a small dispatch budget, keep the selected camera position stable while its construction finishes. The example queues the latest requested camera and applies it after the current construction. Updating the position during construction restarts the view tasks for the new position. It does not enable approximate translation reuse. Continuous motion at XR frame rates has not been qualified.

'''+needle)
s=s.replace('a monotonically increasing resource `generation`, and named read-only texture-view descriptors including dimension and format', 'a resource `generation` fixed at 1 for the instance, and named read-only texture views. Compare the owner as well as the generation; dimensions and formats are documented below')
s=s.replace('The reader provides a direct-integration fallback where LUT interpolation is invalid.', 'The public solar reader performs direct spectral integration. Sky construction uses cached solar columns with a direct-integration fallback when shadowed interpolation corners invalidate the lookup.')
s=s.replace('The exact physical storage layout is an implementation task. This contract fixes their meaning and ownership, not an untested binding-number table.', '''The reader layout is explicit and stable:

| Binding | Resource | Layout |
| --- | --- | --- |
| 0 | Frame parameters | 160-byte uniform: 8 float vec4 records, then quality and size uint vec4 records |
| 1 | Layer profiles | Read-only storage, 32 bytes per layer, kilometre bounds and shape |
| 2 | Spectral coefficients | Read-only storage, 304 bytes per wavelength triple, inverse-kilometre coefficients |
| 3 | Phase functions | Unfilterable `rgba32float` 2d texture, `512 x (groups * layers)` |
| 4 | Sky radiance | `rgba16float` 2d-array, `width x (2 * hemisphereRows) x groups` |
| 5 | View-path transmission | Same format and dimensions as radiance |
| 6 | Sky sampler | Linear filtering, repeat azimuth, clamp elevation |
| 7 | Horizon elevations | Read-only storage, one float32 radian value per azimuth |
| 8 | Solar columns | Unfilterable `rgba32float` 3d texture, `64 x 32 x 32`, four layer columns in kilometres |

Solar texels with a negative first component represent blocked samples. Other solar texels contain density columns, not RGB transmittance. The azimuthal solar map concentrates samples near the terminator; altitude is quadratic. Sky elevation is quartic on each side of the ellipsoidal horizon. Tangent texels evaluate the two limiting path lengths explicitly, and a `2e-7` radian reader band snaps to those limits to match the declared float32 direction uncertainty.

Default quality is width 64, 64 rows per hemisphere, 256 view steps and 192 solar steps. These values match the qualification profile. Lower quality options change the numerical error and require their own validation.''')
s=s.replace('Version 1 allocates resources at creation', 'Version 1 allocates persistent resources at creation; bounded staging uploads are retired after their command buffers have been submitted. It')
s=s.replace('The sky milestone is complete only when all five steps and the numerical acceptance gates pass. Contract publication alone does not make the runtime available.', 'These steps are implemented by the separate entry, laboratory adapter, packed consumer and browser harness. Run both `npm run check` and `npm run test:webgpu` when changing the renderer. The browser job fails if WebGPU is missing; the repository CI workflow runs the same command and saves its report and screenshot.')
put('docs/WEBGPU-INTEGRATION.md',s)

p=root/'docs/WEBGPU-PRECISION.md';s=p.read_text()
s=s.replace('Status: executable-test specification for the integrable-sky implementation. No new GPU qualification has been performed by writing this document.', 'Status: qualification protocol implemented by `tests/browser/validate.js` and `tests/webgpu-tolerances.json`. The latest local execution writes `.cache/webgpu-validation.json`. A recorded passing run applies to its adapter, browser, quality and listed cases.')
s=s.replace('The initial implementation candidate splits each ECEF origin component into a float32 high part and a residual low part, and evaluates camera-relative ray segments with compensated geometric equations.', 'The implementation splits each scaled ECEF origin component and reciprocal axis into float32 high and residual low parts. Compensated products and sums retain this information through ray/ellipsoid intersections and the ellipsoid implicit residual. Altitude uses a stable normal-line intersection, an approximation to geodetic distance whose error is checked at the listed positions. It is not a replacement for the CPU geodesy implementation.')
s=s.replace('## Error budget and pass criteria', '''## Float32 directions and exact tangency

The frozen budget includes `2e-7` radians for a normalized float32 direction. At exact tangency, an opaque ellipsoid produces different limiting radiances on its two sides. Compare the GPU result to independently integrated CPU bounds at the central direction and both angular offsets. Report the raw central-direction error as `pointError` and the distance outside this envelope as the acceptance error. Bracketing rays at `+/- 2e-4` radians retain the ordinary pointwise tolerance; they cannot use the tangent envelope.

Sky construction evaluates both tangent limits explicitly. Tiny negative geometric heights caused by rounding only in these limit texels are projected to one millimetre above the ellipsoid before evaluating density and sunlight. This correction is not applied to ordinary ray integration. The reader uses the same direction-uncertainty band when sampling the limit texels.

## Error budget and pass criteria''')
s=s.replace('No numerical threshold is declared validated by this specification. Derive thresholds', 'The committed manifest fixes maximum absolute radiance error at 0.002 reference-solar-normalized units, spectral solar transmission error at 0.002, and relative radiance error at 5% above signal magnitude 0.04. Reference convergence must be at most 0.0005. Camera altitude tolerance is 0.01 m below 10 km and 1 m from 10 km upward; non-tangent ground intersections have a 1 m tolerance. Derive thresholds')
s=s.replace('The absence of a committed justified tolerance manifest blocks the sky milestone.', 'Changing these thresholds requires a new stated rendering budget, not merely a failing candidate. The latest report records central and envelope errors separately.')
s+='''
## Current automation

The default suite contains 25 body/camera/medium configurations, 50 views and 350 paired-eye radiance probes. It covers Earth and Mars, equator and both poles, 0 m through 1,000 km, day/terminator/night, one to four layers, 24/48 wavelengths, a Gaussian incident spectrum, zero density, both sides of regime crossings and the horizon. Per-case source and quality metadata are retained. The suite also checks live-renderer device loss and disposal.

The packed consumer is installed into a fresh directory for each run, and its entry is compared byte-for-byte with the current build. Its root declarations compile with ES2022 alone; the WebGPU declarations compile with ES2022 plus DOM and the distributed WebGPU type dependency. Chrome then exercises ground/orbit translations and rotation, followed by the laboratory's public spectral path and native PNG export.

Run `npm run test:webgpu` after installing Chrome (or `npx playwright install chrome`). `CHROME_CHANNEL=chromium` selects a Playwright-installed Chromium; the default is Chrome. No browser test is silently skipped when an adapter is unavailable. The CI definition is `.github/workflows/webgpu.yml`; a local passing result does not assert that the remote job has already run.

Arbitrary layer discontinuities, very narrow custom profiles, other ellipsoids and different quality settings still require case-specific convergence and error measurements. No universal precision guarantee is inferred from these representative cases.
'''
put('docs/WEBGPU-PRECISION.md',s)

p=root/'README.md';s=p.read_text();start=s.index('## WebGPU integration work');s=s[:start]+'''## WebGPU sky rendering

`@spacexr/atmosphere/webgpu` exports `AtmosphereSky`, `atmosphereSkyWgsl` and typed camera, quality and binding contracts. It borrows the host's device and encoder; the host owns submission, canvas, drawing and display transforms. Use one instance per view or XR eye. The CPU root entry remains free of DOM and WebGPU runtime requirements.

```ts
import { AtmosphereSky } from "@spacexr/atmosphere/webgpu";

const sky = await AtmosphereSky.create(device, atmosphere);
sky.update(camera);
const encoder = device.createCommandEncoder();
const ready = sky.encode(encoder);
if (ready) {
    const { layout, group } = sky.bindings();
    // Use layout in the host pipeline; bind group 0 in a later render pass.
}
device.queue.submit([encoder.finish()]);
// Repeat encode on submitted encoders until ready, then draw as needed.
// Call sky.dispose() after the last submission using this instance.
```

Construction is progressive and restarts the view tasks after translation. Rotation reuses the full-sky cache. Changing atmosphere, sunlight, source spectrum or quality requires a replacement instance. The WGSL reader returns scene-linear spectral sky radiance without an invented ground color, stellar disk, exposure or tone mapping. Terrain aerial perspective belongs to the next milestone.

See the [integration contract](docs/WEBGPU-INTEGRATION.md), [precision protocol](docs/WEBGPU-PRECISION.md) and [standalone consumer](examples/sky-consumer/README.md). Run `npm run test:webgpu` for the packed-consumer Chrome suite. Reconstruction cost and XR frame rates are not qualified by numerical agreement.
''';s=s.replace('and `package.json`.','`webgpu`, and `package.json`.');put('README.md',s)

put('examples/sky-consumer/README.md','''
# Standalone injected-device sky

This example is outside the research laboratory. It uses only public exports and embedded shaders. The host creates the device, canvas context, display pipeline and command encoders. `display.js` owns exposure and the display transform; `probe.js` is an explicit diagnostic readback helper.

From the package repository:

```sh
npm ci
npm run build
npm pack --ignore-scripts
cd examples/sky-consumer
npm install --ignore-scripts
npm start
```

Open http://127.0.0.1:8098. Drag to rotate, use W/S to change altitude, O for orbit and G for one metre above the ground. Construction finishes for a camera snapshot before the latest queued movement is applied. There is no claim of continuous-motion XR performance. The example shows atmospheric path radiance alone; the dark lower half contains no terrain material.

`npm run test:webgpu` from the repository automates installation into a fresh independent consumer, CPU/GPU comparisons, actual GPU completion, keyboard movement, rotation and the laboratory adapter. It saves `.cache/webgpu-validation.json`, `.cache/sky-consumer.png` and `.cache/lab-public-validation.json`. `CHROME_CHANNEL` selects another installed Playwright browser channel.
''')
p=root/'docs/INTEGRATION.md';s=p.read_text();start=s.index('## Démarrage de la mise en œuvre');end=s.index('## Plan de corrections',start)
s=s[:start]+'''## État de la mise en œuvre du ciel intégrable

Le [contrat WebGPU du ciel](WEBGPU-INTEGRATION.md) décrit l'entrée publique implémentée, ses responsabilités et ses conventions. Le [protocole de précision](WEBGPU-PRECISION.md) définit les budgets et les cas CPU/GPU automatisés.

L'entrée `@spacexr/atmosphere/webgpu` reçoit le device et l'encoder du moteur. Elle fournit une construction progressive bornée, les bindings explicites et les lecteurs WGSL embarqués. Une translation reconstruit la Sky-View ; aucune réutilisation approximative n'est activée. Le mode spectral du laboratoire utilise cette API. `examples/sky-consumer` est un client autonome installé depuis un tarball par le test navigateur.

Les contrôles sont `npm run check`, `npm run test:webgpu` et `npm pack --dry-run`. Le test navigateur conserve son rapport local dans `.cache/webgpu-validation.json` et vérifie aussi les déplacements, les deux vues, la perte de device et le chemin public du laboratoire. La CI dédiée est configurée ; son exécution distante reste à constater après envoi des changements.

La perspective aérienne du terrain reste le second jalon. La réutilisation calibrée, le partage des ressources solaires entre yeux et les garanties de débit XR restent des optimisations ultérieures.

Les constats historiques et le plan ci-dessous sont conservés pour expliquer les travaux ; les points d'extraction, de caméra et de distribution du ciel sont désormais implémentés.

'''+s[end:];put('docs/INTEGRATION.md',s)

p=root/'CHANGELOG.md';s=p.read_text();first=s.index('\n');s=s[:first+1]+'''
## Unreleased

- Add the injected-device WebGPU sky entry with progressive host-owned construction, typed cameras, explicit read bindings and embedded WGSL.
- Support translated cameras, ellipsoidal compensated geometry and independent per-eye resources.
- Make the spectral laboratory a public renderer client; add a standalone packed consumer and Chrome CPU/GPU qualification suite.
- Document the renderer ABI, numerical budgets and the separate terrain milestone.
'''+s[first+1:];put('CHANGELOG.md',s)
