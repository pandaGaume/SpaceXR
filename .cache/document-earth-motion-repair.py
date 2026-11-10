from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
f=root/'docs/validation.md';s=f.read_text(encoding='utf-8');s+='''
## Follow-up: moving camera, sunset, Mapzen and SSE

The initial static smoke qualification did not establish correct moving-camera compositing or interactive performance. User feedback exposed a vertically flipped WebGPU display texture, a frozen image during progressive translation bakes, missing direct solar-disc rendering, and expensive close-view DEM decoding on the main thread. The earlier engine-reported FPS figures must not be interpreted as GPU-completion latency measurements.

The Earth bridge now flips/clamps its display texture, clips interpolated sky radiance to the backend's analytic atmosphere interval, completes a small current-position spectral cache while moving, and refines a separate cache only at rest. It waits for its preceding GPU submission rather than accumulating stale work. The solar disc uses the same spectral irradiance and transmission as the sky. No optical coefficients or scattering model were changed.

The close view reuses the existing Mapzen Terrarium source factory with the Celestial Earth system, its original terrain configuration, child height ranges, DEM generation/interpolation and GPU terrain engine. DEM decoding uses two existing decoder workers. Legacy globe imagery is confined to the orbital page. Both samples default to SSE 20 px, configurable with sse, and one render pixel per CSS pixel, configurable with dpr. Runtime telemetry is collected four times per second instead of traversing every runtime node each frame.

The corrected sunset preset targets the Sun above the geometric horizon with a small clearance for the actual terrain. In the stabilized captured Mapzen view it uses 37 implicit terrain tiles, two decoder workers and only Mapzen Terrarium DEM URLs. There are no page, console or uncaptured WebGPU errors. The captured Sun remains visible after the DEM finishes refining.

The camera regression moves the Earth centre and inclines the view with its orbital pitch lock disabled. The projected globe centre moves from screen row 482.3 to 525.4. All four views have zero bright pixels beyond the CPU-computed atmospheric envelope plus a two-source-texel filtering margin. This checks genuinely off-centre views, not just longitude changes with a centred globe.

The motion benchmark waits for GPU completion after every measured image. In the local 1200x860 Mapzen test, median latency is 4.7 ms and p95 is 6.8 ms with atmosphere. At 2560x1440 CSS pixels on a simulated DPR-2 screen, with the sample's bounded render density, median is 6.1 ms and p95 is 9.8 ms. These are 60-image hardware/browser-specific latency samples, not universal FPS or XR guarantees. The corresponding no-atmosphere runs and full results are recorded beside them under SpaceXR/.cache/earth-motion.

The rendering workspace check passes 176 tests, type checking, lint, formatting and all builds. Targeted regression tests additionally assert that no older-position cache is published during startup/movement, that rotation redraws without rebuilding optical tables, that texture UV/clamp state is correct and that GPU work cannot accumulate across frame submissions. Provider tests confirm that the shared Mapzen source honours an explicit surface without changing its Terrarium URL/encoding. The changed package and sample were rebuilt after the final texture-edge and sunset adjustments.
''';f.write_text(s,encoding='utf-8',newline='\n')
print('Recorded moving-camera regression, actual GPU timings and shared Mapzen verification.')
