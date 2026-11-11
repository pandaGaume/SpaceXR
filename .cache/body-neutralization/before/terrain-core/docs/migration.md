# Framework recomposition

## First delivery

Reorganize the repositories, packages, documentation and VS Code workspaces while preserving the currently working 3D Tiles and terrain framework. Package identities, versions, exports, algorithms and shaders are unchanged.

`3d-tiles-core/node/packages/{core,tiles,runtime}` remains the shared foundation. `terrain-core/packages/{raster,dem,grid}` owns the terrain data and grid packages. `spacexr-rendering/packages/core` owns the existing Babylon adapter; `packages/tools` and both examples move with it.

## Build and integration

From `spacexr-rendering`, run `npm run framework:install`, `npm run framework:build`, then `npm run framework:verify`. The install uses the committed lockfiles and local links. Checks run in core, terrain, rendering order. Use `npm run example:implicit-grid` or `npm run example:google-3d-tiles` here.

Explorer and the tile service update their local file dependencies, lockfiles and source aliases. Their public imports remain unchanged. The additional direct DEM/raster consumer in `geomodels-babylon/packages/dev/studio` follows the same new terrain paths. Reinstall those consumer workspaces after migration; restart existing Vite processes so they serve the new source tree.

No global `npm link` is required. The workspace roots declare sibling `file:` dependencies while publishable packages retain versioned dependencies. The root `.npmrc` keeps `install-links=false`. `framework:verify` rejects stale links or copied packages at old locations.

## Documentation ownership

Terrain owns rasters, DEM, grid and draping contracts. Core owns the standard model, implicit tiling, addressing and runtime. Rendering owns the terrain pipeline, terrain settings, renderer evaluation and benchmark history. Historical logs retain their original measurements and revisions. Old documentation paths point to the new owner.

`celestial-core`, `geodesy_ts`, Quantia and `spacexr-atmosphere` keep their current implementations. Atmosphere consolidation and all new functional work are later phases. Existing Spatial Awareness documents remain with their owners.

## Source provenance and rollout

The local migration audit records source revisions, hashes, existing user changes and backups before edits. Existing staged tests and untracked work are preserved or transferred byte for byte. No commits, pushes, tags or publications are performed by this migration.

New repositories must be committed and pushed in a coordinated sequence before their remote CI can check out each other. Configure npm trusted publishers for any moved package before a future publication; old release workflows must no longer publish extracted packages. CI only checks and builds. The old Babylon repository becomes a compatibility launcher pointing at the new rendering workspace.

## Qualification

The baseline checks pass before extraction. Qualification requires the existing tests and builds in all three canonical repositories, canonical package-link checks, example builds, consumer checks and a separate browser smoke test where local data are available. Network-backed Google, Mapzen and planetary data retain their existing availability and credential requirements; a package build is not a visual regression test.

## Cube deferred

The first delivery preserves the working 3D Tiles and Web Mercator terrain reference. Cube rendering functions are set aside at the user's request. Existing generic cube addressing/data tests remain, and the original repositories retain their experimental branches and history. No cube port or algorithm merge is part of this recomposition. Explorer's imports of cube-only APIs are documented as a deferred integration, not silently replaced.
