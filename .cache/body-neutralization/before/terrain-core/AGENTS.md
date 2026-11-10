# Terrain Core

Owns `@spacexr/raster`, `@spacexr/dem` and `@spacexr/grid` in `packages/`.
`@spacexr/tiles`, 3D Tiles contracts and the single runtime remain in the sibling `3d-tiles-core` repository.
Keep terrain algorithms renderer-neutral. Do not introduce another selector or runtime.
Prefix TypeScript interfaces with `I`. Document units, reference frames and raster registration.
Run `npm run check` from this root. Build `../3d-tiles-core/node` first.
Keep existing package names, public exports and numerical behavior during this migration.
The current phase changes packaging, documentation and tooling only.
No npm publication without an explicit request. Trusted publishing must be configured for the new repository first.
Never use the em dash character.
