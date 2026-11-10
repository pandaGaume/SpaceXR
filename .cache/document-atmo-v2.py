from pathlib import Path
import urllib.request
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
a=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
source=urllib.request.urlopen('https://raw.githubusercontent.com/ebruneton/precomputed_atmospheric_scattering/master/atmosphere/demo/demo.cc').read().decode()
license=source[source.index('/**')+3:source.index('*/')]
license='\n'.join(line.removeprefix(' * ').removeprefix(' *') for line in license.splitlines()).strip()
(r/'packages/babylon-earth/THIRD-PARTY-NOTICES.md').write_text('''# Ozone reference data

`src/earth-ozone.ts` uses the 48 ten-nanometre bin averages of O3 absorption cross sections at 233 K from Eric Bruneton's 2017 demonstration. The original measurements are the Bremen ozone reference spectra, not a fitted sky-color curve.

Sources: [Bruneton reference table and ozone profile](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.cc), [Bremen ozone spectroscopy](https://www.iup.uni-bremen.de/gruppen/molspec/databases/referencespectra/o3spectra2011/index.html).

The reference column is 300 Dobson units. The density rises linearly from zero at 10 km to its maximum at 25 km, then falls to zero at 40 km. This is a fixed clear-sky reference assumption, not a local or real-time ozone observation. The table entries represent 360-370 nm through 830-840 nm bins and are interpolated at their centers.

The table is redistributed under its original license:

```text
'''+license+'\n```\n',encoding='utf-8')
p=r/'packages/babylon-earth/AGENTS.md'
# Scope guidance lives in the repository root.
p=r/'AGENTS.md';s=p.read_text(encoding='utf-8').replace('State WebGPU and single-scattering scope explicitly.', 'State WebGPU and the isotropic higher-order scattering approximation explicitly. Earth reference ozone belongs in babylon-earth; generic absorption layers and spectral transport belong in spacexr-atmosphere.');p.write_text(s,encoding='utf-8')
p=r/'packages/babylon-earth/README.md';s=p.read_text(encoding='utf-8').replace('use the existing single-scattering spectral backend', 'use the existing spectral backend with an isotropic higher-order scattering closure').replace('Clouds, multiple scattering and atmospheric terrain shadows are outside this implementation.', 'Clouds and atmospheric terrain shadows are outside this implementation. Earth supplies a 300 DU ozone absorption layer with a 10-40 km tent profile and published spectral cross sections; explicit custom physical layers replace that default composition. See [reference data and license](THIRD-PARTY-NOTICES.md).')
s+='''
## Diffuse atmosphere

Earth enables `quality.multipleScattering` by default. The backend computes a small spectral altitude/Sun-zenith table once per immutable atmospheric snapshot and reuses it during camera motion. The table approximates higher-order scattering as isotropic, with the angularly averaged source divided by one minus the scattering-return probability. Its geometry is a two-dimensional local approximation on an ellipsoidal reference meridian; the direct view ray, terrain depth and solar transport remain ellipsoidal. Ground-reflected indirect light is not included. Disable this closure explicitly with `quality: { multipleScattering: false }` for a single-scattering comparison. Neither ozone nor this closure imposes a blue screen-space tint.
'''
p.write_text(s,encoding='utf-8')
p=a/'docs/WEBGPU-INTEGRATION.md';s=p.read_text(encoding='utf-8');s+='''
## Absorption and diffuse higher orders

`createAtmosphereLayer` accepts an absorption-only medium with strictly ordered wavelength/cross-section samples and a reference molecular number density. Extinction is interpolated cross section times density; scattering is zero. `tent` profiles use `max(0, 1 - abs((height-referenceHeight)/scaleHeight))` inside their declared support. CPU and GPU pack the same analytic profile. Planet-specific cross sections and column assumptions belong to the consuming body composition, not to generic transport defaults.

`IAtmosphereSkyOptions.multipleScattering` defaults to false, preserving the direct single-scattering reference mode. When enabled, a 32 by 16 spectral table adds an isotropic higher-order closure following [Hillaire 2020](https://diglib.eg.org/items/8a3e5350-18b3-46bd-9274-3add5af88c75). It samples 32 deterministic sphere directions and 24 view segments at each altitude and Sun zenith, accumulates the isotropic source and scattering-return probability, then sums the geometric series. It includes no ground bounce. This is an approximation to multiple scattering, not a full angular radiative-transfer solution or an observational calibration.

The additional work is eight dispatches for 24 wavelengths, once per snapshot after solar-column construction. It is not rebuilt on camera translation or rotation. View integration samples this shared diffuse source for both sky and finite-distance aerial transport. Public group 0 additionally binds the spectral table at 9 and its clamped filtering sampler at 10. `bindings().multipleRadiance` exposes it for numerical qualification when enabled. The browser harness compares table values against independent double-precision CPU quadrature using direct solar columns. The existing single-scattering CPU/GPU suite stays enabled separately.
''';p.write_text(s,encoding='utf-8')
