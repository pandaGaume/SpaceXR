from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
for relative in ['packages/babylon-earth/src/earth-runtime.ts','packages/babylon-earth/src/terrain-adapter.ts','packages/babylon-earth/tests/terrain-adapter.test.ts']:
    f=root/relative;s=f.read_text(encoding='utf-8').replace('MeshTerrainEngine','GpuTerrainEngine').replace('IBabylonGeodesicGridHandle','IGpuTerrainHandle')
    s=s.replace('{ cells, maxDrapeDepth: 0 }','{ cells }')
    f.write_text(s,encoding='utf-8',newline='\n')
f=root/'examples/babylon-earth/src/main.ts';s=f.read_text(encoding='utf-8').replace('    engine.useReverseDepthBuffer = true;\n','');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'packages/babylon-earth/README.md';s=f.read_text(encoding='utf-8').replace('The generic SpaceXR TileRuntime selects','The existing GPU terrain adapter keeps geometry camera-relative on both Babylon WebGPU and WebGL. The generic SpaceXR TileRuntime selects');f.write_text(s,encoding='utf-8',newline='\n')
print('Earth now uses the existing camera-relative GPU terrain adapter on both graphics APIs.')
