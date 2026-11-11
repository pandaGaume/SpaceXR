from pathlib import Path
import json
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
f=root/'AGENTS.md';s=f.read_text(encoding='utf-8').replace('optional future babylon-earth package','optional babylon-earth package');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'docs/framework-migration.md';s=f.read_text(encoding='utf-8').replace('The optional future `@spacexr/babylon-earth` composition belongs','The optional `@spacexr/babylon-earth` composition now lives').replace('It will combine Celestial physical descriptors, the existing tile runtime, terrain, camera and atmosphere integration.','It combines Celestial physical descriptors, the existing tile runtime, terrain, camera and the public spectral atmosphere integration.');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'docs/validation.md';s=f.read_text(encoding='utf-8').replace('The proposed `@spacexr/babylon-earth` composition and Babylon atmosphere integration are documented architecture targets, not implemented packages. See [architecture](architecture.md).','The optional Earth composition is implemented and qualified separately below. See [architecture](architecture.md).')
s+='''
## Earth composition qualification

Date: 2026-11-10. The final rendering `npm run check` passes: package/example builds, format, lint, type checking and 172 tests, including eight Earth model/camera/lifecycle/imagery tests. The unchanged core and terrain checks in this delivery passed 213 and 184 tests respectively, bringing the checked framework total to 569. Quantia, Celestial and Atmosphere were built through the public dependencies; this is integration qualification, not a new independent scientific qualification of those models.

`framework:verify` resolves all ten packages through actual ESM import conditions, including Earth, Celestial and Atmosphere. The compiled Earth entry imports successfully outside the sample source aliases. Its npm dry-run payload contains JavaScript, declarations, source, README and license; no publication occurred.

Both independent HTML/TypeScript entries run in Chrome with hardware-backed WebGPU. Measured camera ellipsoidal heights are 11999997.924 m for orbital.html and 10978.807 m for atmosphere.html. The latter completes loading the real Mapzen DEM and displays 136 selected implicit terrain tiles in the captured view. The test waits for submitted GPU work and records zero uncaptured GPU validation events, page errors or console errors. Screenshots and data are under `SpaceXR/.cache/earth-validation` (orbital.png, atmosphere.png and two-pages.json). These are two smoke views, not exhaustive numerical or device coverage.

The interaction check exercises atmosphere visibility, changed Sun/date, camera movement, resized viewport and explicit WebGL terrain-only mode. It confirms that Earth disposal removes owned meshes, lights and camera while preserving the borrowed scene. No browser errors were reported. Eight unit tests cover catalogue shape/gravity reuse, solar direction, camera handedness, actual TileRuntime composition, explicit WebGL atmosphere rejection and imagery readiness/residency cleanup.

The selected Earth default is the existing GPU terrain adapter, which keeps geometry camera-relative and avoids the visible precision artifacts seen in the initial absolute-coordinate mesh smoke. The mesh adapter remains available through terrain.engine. The attempted reverse-depth sample configuration was removed; it is not part of this qualification. No generic terrain or tile-selection algorithm was changed for Earth.

Current limits: atmosphere is spectral sky/limb on WebGPU, with progressive camera snapshots. Depth-based aerial perspective, clouds, continuous-motion XR and automatic device recreation are not included. Orbital imagery is a legacy local demonstration asset; it is not close-range measured imagery. Static polar caps are placeholders beyond Mercator. See the [library contract](../packages/babylon-earth/README.md) and [both sample entries](../examples/babylon-earth/README.md).
''';f.write_text(s,encoding='utf-8',newline='\n')
for name in ['SpaceXR-Framework.code-workspace','SpaceXR-Applications.code-workspace']:
    f=root/name;d=json.loads(f.read_text(encoding='utf-8'));tasks=d['tasks']['tasks'];labels={t['label'] for t in tasks}
    for label,command in [('Earth: orbital','npm run example:earth:orbit'),('Earth: atmosphere','npm run example:earth:atmosphere')]:
        if label not in labels:tasks.append({'label':label,'type':'shell','command':command,'options':{'cwd':'${workspaceFolder:Rendering}'},'problemMatcher':[],'isBackground':True})
    f.write_text(json.dumps(d,indent=4)+'\n',encoding='utf-8',newline='\n')
print('Recorded the final Earth results and separate VS Code launch tasks.')
