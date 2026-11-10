# Renderer evaluation and decision

Status: Accepted  
Date: 2026-09-27

## Context

The renderer-neutral runtime must support large WGS84 scenes, implicit tiling,
stable geographic navigation and predictable tile selection. Babylon.js 9 was
the initial reference implementation, using WebGPU and its
`GeospatialCamera`.

Babylon Lite 1.31.1 was evaluated to determine whether its smaller runtime
could reduce memory or rendering cost without changing the 3D Tiles pipeline.
The comparison used the same global WebMercator source, WGS84 tile geometry,
implicit quadtree, runtime configuration, camera placement, cache limits and
viewport.

## Results

Both implementations selected the same initial working set: 30 of 217 runtime
nodes were selected and 38 tile contents were ready. Both reached the display
refresh ceiling during interactive use. The user-facing test remained at 60
FPS and showed no perceptible frame-rate improvement with Babylon Lite.

Babylon Lite produced a substantially smaller JavaScript bundle in this
experiment, approximately 144 kB minified and 47 kB compressed, compared with
approximately 6.79 MB minified and 1.49 MB compressed for the Babylon.js
example. Its observed JavaScript heap was also lower. These gains did not
improve the effective navigation or rendering experience of the test scene.

The decisive difference was geographic navigation:

- Babylon Lite globe picking uses an analytic sphere whose radius is the
  configured semi-major axis, rather than the WGS84 ellipsoid.
- At the initial latitude of 48.25 degrees, the configured spherical radius
  and the WGS84 ECEF surface radius differ by approximately 11.86 km.
- Babylon Lite floating origin removes camera translation from the view
  matrix. Its geographic controls use that rebased matrix to build screen
  picking rays, then treat those rays as absolute ECEF coordinates.
- With floating origin enabled, panning became ineffective or erratic and
  cursor-centred zoom produced excessive changes in viewpoint.
- Disabling cursor-centred zoom stabilised the wheel but reduced navigation
  quality. Disabling floating origin restored panning but removed the precision
  mechanism required for planetary coordinates.
- Babylon.js `GeospatialCamera`, combined with the WGS84 geodetic surface
  normal already supplied by the adapter, preserved stable navigation.

No console error explained the difference. Tile traversal, selection and cache
behaviour remained equivalent, which confirms that the issue belonged to the
renderer camera controls rather than the renderer-neutral runtime.

## Decision

Babylon.js 9 with WebGPU and `GeospatialCamera` remains the reference renderer
adapter. The runtime remains independent of Babylon.js so other renderer or
engine adapters can still be implemented later.

The Babylon Lite experiment and its source code are not retained. Maintaining
an additional adapter without a measurable frame-rate benefit, while losing
the required geographic navigation, would create a dead implementation branch.

Note of 2026-11-07: the adapter renders with WebGL from its GLSL shaders,
and with WebGPU from WGSL shaders written for it; the two are compared pixel by
pixel with `npm run compare:renderers`. Until then, its WebGPU engine ran the
GLSL shaders converted to WGSL by Babylon.js.

Babylon Lite may be reconsidered only if all of the following become true:

1. screen picking remains in absolute ECEF coordinates with floating origin;
2. navigation supports a configurable ellipsoid and geodetic surface normal;
3. pan, rotation and cursor-centred zoom reach behavioural parity with the
   Babylon.js geographic camera;
4. a repeatable workload demonstrates a material runtime benefit.
