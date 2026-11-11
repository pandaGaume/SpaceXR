# Repository recomposition validation

Date: 2026-11-10. This delivery changes repository ownership, package metadata, local dependency links, documentation and VS Code workspaces. It does not change rendering algorithms or numerical behavior. Cube rendering is deferred at the user's request.

## Verified framework

- Baseline `npm run check` passes in the original core and Babylon workspaces before extraction: 511 and 168 tests respectively.
- A clean `npm run framework:install` from lockfiles, followed by `npm run framework:check`, passes after retirement of the original source directories: 679 tests, formatting, lint, type checking, shader generation and both example builds.
- `npm run framework:verify` checks seven package identities and their canonical resolutions from the rendering root, adapter and examples. Local package versions and existing third-party dependency versions are preserved.
- The migration audit verifies 182 implementation and test files byte for byte. Existing staged runtime tests remain staged; untracked Babylon tests and example assets were transferred with their source directories.
- All five VS Code workspaces have existing folder paths, valid named-folder task references and an existing TypeScript SDK. Local documentation links in the new terrain and rendering documentation resolve.

## Browser smoke check

A separate Vite server used port 5187 and the canonical rendering sources; existing development servers were not reused. The existing comparison tool rendered the Mont Blanc GPU terrain with DEM-derived normals, `sse=512`, through WebGL/GLSL and WebGPU/WGSL. It reported no page or GPU validation errors. The screenshots differ in 601 of 905760 pixels, about 0.066 percent; this is a smoke check, not a claim of pixel identity or a full visual regression qualification.

An earlier two-second moving-camera test hit its explicit 400-request cap and reported page errors. Its zero-hole report is not accepted as an integrity result. The subsequent fixed-view check retained the request cap and completed without those errors. Google streaming still requires the existing provider credentials and was covered here by build and adapter tests, not a live external-data session.

## Consumers

| Consumer | Result |
| --- | --- |
| `geomodels-babylon` studio | Type checking passes; all 295 studio tests pass with relocated DEM/raster links |
| `spacexr-tile-service` | Build and all 46 functional tests pass; full type checking still reports the two lunar-tool errors below |
| `spacexr-explorer` | Dependency links and Vite source alias point to the new owners; full build is deferred because its source imports cube APIs absent from the current main branches |

Explorer expects `CubeTileDataSource`, `cubeTileBoundingBox`, `createCubeGridSource` and `cubeTiling`. Those implementations are absent from the main source trees being recomposed; the original histories retain experimental cube branches. The consumer files were not changed to imitate these APIs. Their integration is deferred with cube rendering.

The service type checker reports `tools/lunar/shackleton-refinement.ts:86` (unknown raster registration value passed to a numeric comparison) and `tools/lunar/sldem2015-comparison.ts:222` (unused `receipt`). These tool source files were not modified by the repository migration. They do not block the standalone 3D Tiles/Mercator framework, and no speculative functional fix was included.

## Local delivery and rollback

No commit, push, tag or npm publication has been performed. The new repositories need coordinated initial commits and pushes before cross-repository remote CI can run. Moved package trusted publishers need explicit configuration before a future publication.

The retired source directories remain under ignored `.framework-recomposition-backup/` directories in their original repositories. Initial metadata, source hashes and command logs are retained in the local migration audit under `SpaceXR/.cache/framework-recomposition`. Existing local environment files were copied privately to the relocated examples; templates remain distributable.

Use `SpaceXR-Framework.code-workspace` for the currently qualified framework. `SpaceXR-Applications.code-workspace` also includes the consumers and exposes their known limitations above. Restart Vite processes that still serve old source paths. The legacy Babylon root commands forward to the canonical rendering workspace.
