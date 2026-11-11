from pathlib import Path
r = Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
p = r/'AGENTS.md'
s = p.read_text(encoding='utf-8').replace('State WebGPU and sky-only scope explicitly.', 'The user authorized finite-distance aerial perspective over actual scene depth. State WebGPU and single-scattering scope explicitly. Keep spectral transport in spacexr-atmosphere; the Babylon compositor only reconstructs distance, samples transport and applies display encoding.')
p.write_text(s, encoding='utf-8')
p = r/'packages/babylon-earth/README.md'
s = p.read_text(encoding='utf-8').replace('in `src/atmosphere/babylon-sky.ts`', 'in `src/atmosphere/babylon-sky.ts` and `scene-compositor.ts`')
a = s.index('Sky and orbital limb use')
b = s.index('Mercator terrain stops', a)
s = s[:a] + '''Sky, orbital limb and finite-distance aerial perspective use the existing single-scattering spectral backend with 24 wavelengths by default. The backend owns optical integration and camera-volume construction. The Babylon compositor reads the HDR scene color and the depth attachment from the same draw, including GPU-displaced terrain. It composes `surface * transmission + inScatteredRadiance`, then applies exposure and sRGB encoding once. RGB transmission is a solar-spectrum-weighted approximation for RGB materials, not independent monochromatic transmittance. Clouds, multiple scattering and atmospheric terrain shadows are outside this implementation.

The compositor attaches to the selected camera before other post-processes and adds FXAA after display conversion. It temporarily enables deferred image processing and clears the scene to black, restoring both settings when disposed. Terrain emits scene-linear color in this composition. The generic adapter retains its previous default output unless `linearColorOutput` is explicitly enabled. The direct solar disc is evaluated at output resolution with analytic pixel coverage. The atmospheric boundary is clipped analytically and sampled across pixel coverage, rather than enlarging a low-resolution Sun or silhouette.

Translation completes a bounded low-resolution spectral sky cache at the current camera position before drawing. A separate higher-resolution cache refines at rest. An associated finite-distance camera volume updates when the view changes. The bridge waits for its previous GPU submission to prevent a queue of stale camera work. Outside the atmosphere, the angular cache concentrates its upper hemisphere on the physical limb instead of empty zenith sky. These resources share the backend's physical coefficients and solar transport.

`aerialPerspective` defaults to true. Set `aerialPerspective: false` only for a diagnostic background-sky comparison. `aerialQuality` controls the finite-distance volume, defaulting to 32 by 18 rays, 16 distances and two integration steps per slice while moving; the settled volume uses 24 distances and three steps. `motionQuality`, `quality` and `dispatchesPerFrame` control the spectral sky cache. Exposure defaults to 4 for the HDR composition. Continuous-motion XR is not qualified. The camera must be unparented, perspective, symmetric, full viewport and above the physical ellipsoid. ECEF metres and a right-handed scene are required. Device loss is reported; automatic engine/device recreation belongs to the application.

''' + s[b:]
s = s.replace('16 azimuth texels, eight rows per hemisphere and 16 integration steps', '32 azimuth texels, 16 rows per hemisphere and 24 integration steps')
p.write_text(s, encoding='utf-8')
p = r/'examples/babylon-earth/README.md'
s = p.read_text(encoding='utf-8').replace('The first delivery includes spectral sky and limb, not aerial perspective on terrain.', 'The default WebGPU composition includes spectral sky, diffuse orbital limb and depth-based aerial perspective over the actual terrain. The Sun is drawn at output resolution and FXAA smooths the final image.')
s += '''
## Orbital horizon

Open `/orbital.html?view=horizon&sse=20` or click **Horizon orbital** for a grazing Earth view. The atmosphere is integrated in front of the planet as well as outside its silhouette. The checkbox compares atmospheric transport on the same HDR surface. The exposure slider defaults to 4. `/orbital.html?aerial=0` retains the background-only path as a diagnostic. The bundled orbital imagery has no dynamic clouds and becomes blurred at close range; this preset does not add a weather system.
'''
p.write_text(s, encoding='utf-8')
p = r/'examples/babylon-earth/src/main.ts'
s = p.read_text(encoding='utf-8').replace('latitudeDegrees: 30, longitudeDegrees: -30', 'latitudeDegrees: 45, longitudeDegrees: 5').replace('view(30, -30,', 'view(45, 5,')
p.write_text(s, encoding='utf-8')
p = Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/docs/WEBGPU-INTEGRATION.md')
s = p.read_text(encoding='utf-8').replace('one float32 radian value per azimuth', 'ground tangent then outer-atmosphere tangent, each one float32 per azimuth')
s = s.replace('Sky elevation is quartic on each side of the ellipsoidal horizon.', 'Sky elevation is quartic below the ellipsoidal horizon and for inside-atmosphere upward rays. Outside the atmosphere, the upper side uses a quadratic mapping between the ground and outer-atmosphere tangents, concentrating samples on the visible limb.')
s = s.replace('A spectrum-weighted RGB reconstruction must not be advertised as three independent physical transmittances or multiplied into an arbitrary material color without a defined approximation. The terrain milestone defines that approximation and `aerialPerspective`; neither depth textures nor camera volumes are required for the sky milestone.', 'A spectrum-weighted RGB reconstruction is not three independent physical transmittances. `AtmosphereAerialVolume` defines an explicit solar-spectrum-weighted approximation for RGB materials: integrate transmitted incident spectral power into RGB, then divide each channel by its vacuum incident white point. Vacuum transmission is exactly one. Apply this approximation only to scene-linear material RGB, before display encoding. It cannot recover an arbitrary material reflectance spectrum.')
s = s.replace('The next milestone adds camera volumes and material integration using actual displaced terrain positions.', 'Finite-distance camera volumes are also implemented and checked against the independent CPU reference in the browser harness.')
s += '''
## Finite-distance aerial transport

After encoding a sky snapshot, call `await sky.createAerialVolume(options)` once. The volume borrows that sky instance and its immutable atmospheric model, solar data and current observer position. Call `volume.encode(encoder, camera)` after encoding the matching sky position and before host submission. `bindings()` exposes filterable `rgba16float` 3D radiance and transmission views plus dimensions. Creation and encoding never submit command buffers. Dispose the volume before its parent sky. Rotation invalidates the view volume; an unchanged camera reuses it.

The x/y endpoints represent full-viewport perspective rays; z endpoints represent evenly spaced fractions of each ray's actual atmospheric interval, including zero distance. The compositor must reconstruct the actual surface distance from the same displaced-geometry pass and map it to `clamp((distance - intervalStart) / (intervalEnd - intervalStart), 0, 1)`. Map endpoint coordinates to texel centers before trilinear sampling. Compose scene-linear `surface * transmission + radiance`. The volume uses the same spectral transport integrator as the sky, accumulating successive finite segments without duplicating scattering physics. Dimensions and segment steps bound memory and work; defaults are 32 by 18 by 16, with two steps per segment.

`integrateSpectral` accepts optional `maxDistanceMeters` for an independent finite-path CPU reference. Zero distance returns zero radiance and unit transmission. The browser suite reads back volume samples and compares both radiance and normalized RGB transmission with this reference, including the zero-distance identity.
'''
p.write_text(s, encoding='utf-8')
