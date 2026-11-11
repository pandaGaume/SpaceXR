from pathlib import Path
base=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
f=base/'examples/babylon-earth/src/main.ts';s=f.read_text(encoding='utf-8')
start=s.index('        element<HTMLElement>("attribution").textContent');end=s.index('        let stopped',start)
s=s[:start]+'''        element<HTMLElement>("attribution").textContent = demEnabled
            ? "Relief Mapzen Terrain Tiles (Terrarium), AWS Open Data. Normales issues du DEM. Sources : tilezen/joerd."
            : inside ? "Surface ellipsoïdale sans relief, mode explicite dem=0."
            : "Imagerie locale de démonstration réservée à la vue orbitale. L’entrée Atmosphère utilise le relief Mapzen.";
'''+s[end:]
s=s.replace('        const frame = async (): Promise<void> => {','        let lastTelemetry = 0;\n        const frame = async (): Promise<void> => {')
start=s.index('                const resources = runtime.terrain.getStatistics();');end=s.index('            } catch (error)',start)
block=s[start:end];s=s[:start]+'''                const now = performance.now();
                // Collecting the runtime snapshot traverses its nodes. Keep telemetry out of the per-frame hot path.
                if (now-lastTelemetry>=250) {
                    lastTelemetry=now;
'''+block+'''                }
'''+s[end:]
f.write_text(s,encoding='utf-8',newline='\n')
f=base/'packages/babylon-earth/README.md';s=f.read_text(encoding='utf-8').replace('Translation builds a new sky snapshot progressively. The previous completed image stays visible while construction finishes.','Translation completes a bounded low-resolution spectral cache at the current camera position before drawing. A separate higher-resolution cache refines at rest; camera rotation redraws every frame. The bridge waits for its previous GPU submission to avoid a queue of stale camera work. External WebGPU display textures are flipped vertically once for Babylon Layer UVs. The display reader clips interpolated radiance to the analytic atmosphere envelope and draws the direct solar disc using the same spectral transmission.')
s+='''
The moving cache defaults to 16 azimuth texels, eight rows per hemisphere and 16 integration steps. `motionQuality` can override those geometric quality settings. The settled cache defaults to 64 azimuth texels, 32 rows per hemisphere and 64 steps. Both use the existing spectral backend and identical physical coefficients. The default progressive budget is two tasks per frame; movement completes the small cache synchronously in the GPU command stream. These caches are atmospheric render resources, not additional tile runtimes.
''';f.write_text(s,encoding='utf-8',newline='\n')
f=base/'examples/babylon-earth/README.md';s=f.read_text(encoding='utf-8');s+='''
## Motion, Mapzen and sunset controls

The inside-atmosphere view reuses `createMapzenTerrariumSource` from the existing terrain sample, configured with the Celestial Earth system. It also reuses the terrain grid configuration, child DEM height ranges, DEM generation/interpolation and GPU engine. PNG/DEM decoding runs through the existing WorkerDemDecoder. The legacy globe image is used only in the orbital view. The close view shades the actual Mapzen DEM and its derived normals.

Both Earth entries now default to SSE 20 pixels, previously 12. Use `?sse=24` or another positive pixel threshold to adjust geometry selection. This affects the existing TileRuntime, not a parallel terrain selector.

Click **Coucher de soleil** in the inside-atmosphere page, or open `/atmosphere.html?sunset=1`. The preset calculates a date for the visible horizon at the observer altitude using Celestial sunlight, then points the camera toward the Sun. The UTC slider now supports minutes. Sky radiance, solar disc and terrain lighting share the same Sun direction. Physical optical coefficients are unchanged.
''';f.write_text(s,encoding='utf-8',newline='\n')
print('Throttled runtime telemetry and documented the corrected render/cache and Mapzen paths.')
