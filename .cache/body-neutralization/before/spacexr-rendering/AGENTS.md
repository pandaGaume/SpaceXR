# SpaceXR Rendering

`packages/core` owns the existing `@spacexr/3d-tiles-babylon` adapter. Its package identity is unchanged.
`packages/tools` owns the shader compiler and existing terrain and renderer comparisons.
`examples` contains the Google 3D Tiles and implicit terrain applications.
The single runtime and tile addressing live in `../3d-tiles-core`; raster, DEM and grid live in `../terrain-core`.
Do not copy those implementations here. Do not add empty future packages or change algorithms during recomposition.
Keep Babylon types in the adapter. Future shared contracts and other adapters must remain independent of Babylon.
Prefix interfaces with `I`. Scenes use ECEF metres, right-handed coordinates and large-world rendering.
Write shaders in their own files. Never edit generated shader TypeScript; run `npm run shaders`.
Applications explicitly register loaders. Do not infer content format from a URI extension.
Run `npm run framework:check` to check sibling core, terrain, adapter, tools and examples in order.
Never measure against an existing development server without stating which sources it serves.
No publication or repository push without explicit authorization. Never use the em dash character.
