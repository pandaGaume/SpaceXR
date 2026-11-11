import json
from recompose_framework import RENDER, write

version=json.loads((RENDER/'node_modules/@babylonjs/core/package.json').read_text())['version']
deps={
    '@babylonjs/core':version,
    '@babylonjs/loaders':version,
    '@spacexr/geodesy':'0.4.0',
    '@spacexr/3d-tiles-core':'file:../3d-tiles-core/node/packages/core',
    '@spacexr/tiles':'file:../3d-tiles-core/node/packages/tiles',
    '@spacexr/3d-tiles-runtime':'file:../3d-tiles-core/node/packages/runtime',
    '@spacexr/raster':'file:../terrain-core/packages/raster',
    '@spacexr/dem':'file:../terrain-core/packages/dem',
    '@spacexr/grid':'file:../terrain-core/packages/grid',
    '@spacexr/3d-tiles-babylon':'file:../spacexr-rendering/packages/core',
}
write(RENDER/'docs/consume-framework.md','''# Use the framework in another application

Keep the application next to `3d-tiles-core`, `terrain-core` and `spacexr-rendering`. Build the framework once from `spacexr-rendering` with `npm run framework:build`. The current reference examples are the fastest working starting point; copy application code into your own project and keep the framework packages linked.

## Local dependencies

Use this dependency block in the sibling application's package.json. The Babylon version below is the version actually installed for the qualified framework, not a new dependency upgrade.

```json
'''+json.dumps({'dependencies':deps},indent=2)+'''
```

Add `install-links=false` to the application's `.npmrc`, then run `npm install`. This links the canonical packages instead of installing stale copies. No global `npm link` is required. The package names and imports remain those used before recomposition.

For a Vite application, follow the reference examples' `preserveSymlinks`, Babylon deduplication where needed, and exclusion of the linked SpaceXR packages from dependency prebundling. Use public package imports in application code. An alias to `packages/core/src/index.ts` is useful for framework development but is not required for a build-based consumer.

## Current functionality

Use [the Babylon adapter API](../packages/core/README.md), [the 3D Tiles example](../examples/babylon-google-3d-tiles/README.md) and [the terrain example](../examples/babylon-implicit-grid-mapzen/README.md). The runtime, data loading, terrain CPU/GPU engines and shaders remain the existing implementations. glTF applications explicitly import the Babylon loader registration, as before.

The first qualified terrain reference is Web Mercator. Cube rendering is deferred. New ridge reconstruction, oriented cliffs, Spatial Awareness, Three integration and new MCP behaviors are subsequent work. Provider credentials, attribution and external dataset availability remain the application's responsibility.

## After changing a framework package

Rebuild with `npm run framework:build` from `spacexr-rendering`, or run the appropriate watch task in `SpaceXR-Framework.code-workspace` after an initial build. Restart a consumer's Vite process if it retained dependency caches from old paths. Use `npm run framework:verify` to check the framework's canonical links.
''')
f=RENDER/'README.md';text=f.read_text(encoding='utf-8')
text += '\nFor another development project, use [the local consumer guide](docs/consume-framework.md).\n'
write(f,text)
f=RENDER/'docs/validation.md';text=f.read_text(encoding='utf-8')
text += '\n## Package payloads\n\n`npm pack --dry-run --json --ignore-scripts` succeeds for all seven public packages. The inspection includes their compiled JavaScript and declarations; no archive was published.\n'
write(f,text)
print('Added a consumer guide using the qualified Babylon version',version)
