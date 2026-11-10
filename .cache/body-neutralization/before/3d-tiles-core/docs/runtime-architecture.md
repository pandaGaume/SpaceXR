# Runtime architecture

## Purpose

`@spacexr/3d-tiles-runtime` extracts the reusable visualization logic from SpaceXR without retaining a dependency on Babylon, a browser scene, a proprietary event system or SpaceXR streaming classes.

The runtime owns the algorithm. The adaptation layer owns host integration.

## Responsibility split

| Responsibility                                | Runtime                            | Adaptation layer                                                                         |
| --------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Tileset tree and runtime state                | Yes                                | No                                                                                       |
| SSE traversal and ADD or REPLACE refinement   | Yes                                | No                                                                                       |
| Hole-free REPLACE transition                  | Yes                                | No                                                                                       |
| Concurrent loading and retries                | Yes                                | No                                                                                       |
| LRU navigation cache and memory budgets       | Yes                                | Reports CPU, GPU and network costs                                                       |
| External tileset grafting                     | Yes                                | Decodes or identifies the external tileset                                               |
| Implicit QUADTREE and OCTREE traversal        | Yes                                | Loads subtree resources through `IImplicitSubtreeLoader`                                 |
| Standard JSON and binary `.subtree` resources | Yes                                | Supplies bytes through `IByteResourceLoader`                                             |
| XYZ or TMS Web Map and DEM pyramids           | Yes                                | Fetches and decodes payloads with `@spacexr/tiles`, `@spacexr/raster` and `@spacexr/dem` |
| URI identity and relative resolution          | Yes, through `IRuntimeUriResolver` | May override resolution                                                                  |
| glTF, terrain or grid preparation             | No                                 | `ITileActivationAdapter` and its readiness port                                          |
| Scene attachment and placement                | No                                 | `ITilePresentationAdapter.present`                                                       |
| Scene removal and disposal                    | No                                 | `ITilePresentationAdapter.hide` and `release`                                            |
| Camera events                                 | No                                 | `ICameraEventSource`                                                                     |
| Visibility, placement and SSE metric          | No                                 | `ISpatialMetric`                                                                         |
| Labels, anchors and glyphs                    | No                                 | `IGlyphPublisher`                                                                        |
| Real-time statistics and metric aggregation   | Yes                                | May forward metrics through `IRuntimeTelemetry`                                          |
| Monitoring backend                            | No                                 | `IRuntimeTelemetry`                                                                      |

The provided `EcefSpatialMetric` is a default implementation for raw ECEF coordinates. It delegates ellipsoid, geodetic conversion and local tangent frame mathematics to `@spacexr/geodesy`. The runtime retains 3D Tiles transform composition, bounding volume derivation, horizon and frustum culling, visibility, and screen-space error. A caller can inject a `GeodeticSystem` for WGS84 or another oblate body. An adapter may replace the complete metric when a scene uses a local origin, a floating origin, another reference frame or another unit.

## Content lifecycle

The preferred API separates camera selection, asynchronous readiness and visual presentation:

1. traversal activates a `Tile3D` through `ITileActivationAdapter.activate`;
2. the adapter prepares each opaque renderer resource;
3. the adapter calls `ITileReadinessPort.ready`, `failed` or `cancelled`;
4. the runtime resolves metadata and calls `ITilePresentationAdapter.present` only when the replacement cut is complete;
5. presentation can be hidden while its renderer handle remains cached;
6. cache eviction calls `release`.

The legacy `ITileContentAdapter` remains supported for compatibility. New Babylon, Three.js or Unreal adaptation packages should implement the split ports.

`Tile3D` uses numeric enums for selection, readiness, presentation, metadata, content kind and refinement. `NO_METADATA` is the numeric sentinel `-1`. Metadata snapshots live in `RuntimeMetadataStore` and are exposed to adapters through numeric handles.

The content adapter returns one of three outcomes:

1. `renderable`, with an opaque host handle such as a Babylon `AssetContainer` or Three.js `Object3D`;
2. `external-tileset`, with a decoded `ITileset` that the runtime grafts into the tree;
3. `empty`, for valid content that produces no renderable resource.

The runtime does not infer content type from a filename extension. This preserves compatibility with extensionless 3D Tiles content URLs and signed endpoints.

For REPLACE refinement, the parent remains presented until every visible item on the replacement front is loaded. New children are attached before the parent is detached.

## Content-measured bounds

A declared bounding volume may be a placeholder, for example a terrain tile declared at 0/0 m whose real height range is only known once its DEM is decoded. Two mechanisms keep culling and refinement correct without modifying the serialized tiles:

1. The renderable result passed to `ITileReadinessPort.ready` may carry `tileBoundingVolume`, the volume of the whole tile measured on its content. The runtime re-derives the tile spatial state from it and marks the tile `contentBoundsRefined`.
2. When the content of an implicit tile becomes ready, the runtime asks the implicit resolver again for the volumes of its materialized children and re-derives their spatial state, except for children already marked `contentBoundsRefined`. A resolver can therefore prepare child volumes from the parent content, for example the four quadrant height ranges of a DEM, even for children materialized before that content arrived.

Both emit a `tile-bounds-refined` event whose `origin` is `content` or `parent-content`.

## Camera and frame processing

An `ICameraFrameSource` may push camera placements. Applications may also call `onCameraChanged(cameraFrame, flags)` and then `processFrame()`. The camera frame carries the frustum consumed by `ISpatialMetric`. Camera values remain opaque to traversal.

The runtime serializes frame processing and coalesces refreshes caused by asynchronous loads. `whenIdle()` waits for both the loading scheduler and the resulting traversal refreshes.

## Navigation cache

Detaching content from the scene does not immediately destroy its renderer handle. The handle remains available for a fast return until the LRU cache reaches a configured age or budget. The runtime enforces independent limits for:

- materialized runtime tile nodes;
- renderable content entries;
- content CPU bytes;
- content GPU bytes;
- loaded subtree entries;
- loaded subtree bytes;
- the time an inactive resource may be retained, 60 seconds by default.

Retention is measured in time, not in frames: the runtime only processes a frame while the camera moves or loads settle, so a frame count would be a few seconds while the camera turns and endless while it rests. The deprecated `unusedFrameRetention` still applies a frame count when an application sets it. The byte budgets bound the memory; the entry budget, 4096 contents by default, only bounds the bookkeeping of many small contents.

The adaptation layer reports `cpuBytes`, `gpuBytes` and `networkBytes` in the renderable `ContentLoadResult`. These values are authoritative because only the renderer integration knows the actual cost of decoded geometry, textures, buffers and engine objects. Missing values are treated as zero, so entry budgets still work even before an adapter can measure memory precisely.

Selected tiles, attached content, active replacement fronts, queued or running loads and subtrees touched by the current frame cannot be evicted. Inactive renderables are disposed in least-recently-used order. Inactive subtree payloads are released independently. Materialized implicit branches are pruned when stale or when the node budget is exceeded, and are generated again from subtree availability when navigation returns.

```ts
const runtime = new TileRuntime({
  id: "mine",
  uri: "https://example.test/tileset.json",
  adapter,
  cache: {
    maxMaterializedTiles: 4096,
    maxContentEntries: 4096,
    workingSetFactor: 3,
    maxContentCpuBytes: 512 * 1024 * 1024,
    maxContentGpuBytes: 1024 * 1024 * 1024,
    maxSubtreeEntries: 128,
    maxSubtreeBytes: 64 * 1024 * 1024,
    unusedRetentionMilliseconds: 60_000,
  },
});
```

`workingSetFactor` makes the budgets of entries and tiles adaptive: they are at least that many times what the view uses, the selected tiles for content and the tiles visited by the traversal for materialized tiles, so that a moving camera does not evict and load the same tiles again and again. They come back as the view needs less. Byte budgets stay fixed. Its default, 0, keeps fixed budgets.

`trimCache()` applies the budgets immediately. `trimCache(true)` releases every inactive cache entry and implicit branch, which is useful after a scene switch or when an application enters the background. Cache evictions are observable through `cache-eviction` events and the `beforeCacheEviction` and `afterCacheEviction` hooks.

## Real-time instrumentation

`runtime.instrumentation` aggregates runtime metrics and produces a current state snapshot. A snapshot includes tile-node counts, content lifecycle states, attached and cached handles, CPU, GPU and network byte estimates, subtree states, scheduler pressure, cache counters and aggregate values for load, frame, attach, detach, error and eviction metrics.

```ts
const unsubscribe = runtime.instrumentation.subscribe((statistics) => {
  dashboard.update(statistics);
});

const current = runtime.instrumentation.snapshot();

runtime.instrumentation.setEnabled(false);
runtime.instrumentation.setEnabled(true);

unsubscribe();
```

Disabling instrumentation stops timers, aggregate updates, subscriber publications and forwarding to `IRuntimeTelemetry`. Cache enforcement remains active. This switch allows production viewers to remove monitoring work from the frame path without changing traversal behavior. `reset()` clears metric aggregates while preserving the current runtime state.

## Implicit tiling

Implicit tiling is implemented as a native traversal path, not as a pre-generated explicit tree. Children are materialized only when traversal requires refinement. The implementation supports:

- QUADTREE and OCTREE coordinates;
- level-concatenated Morton indexing without 32-bit bitwise truncation;
- constant and bitstream tile, content and child-subtree availability;
- sparse child subtrees;
- multiple content templates;
- direct bounding-volume computation from the implicit root to avoid accumulated numerical error;
- standard JSON subtree files;
- standard binary `.subtree` headers and embedded binary chunks;
- external subtree buffers;
- subtree retries, scheduling, telemetry and lifecycle errors.

`StandardImplicitSubtreeLoader` combines a byte-resource loader with the core `SubtreeCodec`. `DenseImplicitSubtreeLoader` provides virtual constant availability for services that already expose a dense regular pyramid and do not publish physical subtree files.

### Web Map and DEM pyramids

`ITileDataSource` defines the physical pyramid. It owns its `ITileMetrics`, absolute root address, URL templates and metadata policy. `WebMapTileDataSource` implements that contract for XYZ or TMS, while `WebMercatorTileMetrics` provides addressing, ground resolution and the authoritative `minLOD` and `maxLOD` bounds.

`ImplicitTilesetDecorator` is deliberately limited to representation. It exposes a data source as a standard implicit 3D Tiles tileset and delegates per-tile resolution back to the source. Its `availableLevels` is derived as `maxLOD - minLOD + 1`, so traversal cannot materialize a source LOD beyond its declared range. `createWebMapImplicitSource` is a convenience factory for this source-plus-decorator composition.

This spatial override matters because standard 3D Tiles `region` subdivision is linear in latitude, while Web Mercator tile rows are not. The source and decorator keep 3D Tiles availability and traversal semantics while supplying the exact per-tile `TILE_BOUNDING_REGION` equivalent at runtime.

The content port receives `implicitCoordinates`, the synthesized tile bounding volume and the derived spatial state. A Babylon terrain adapter can therefore share normalized grid topology while projecting unique per-tile geometry from the geographic region and the selected ellipsoid. Curvature and east-west pinching then follow latitude exactly. A later GPU implementation can bind the region, ellipsoid and DEM as per-instance shader inputs, while keeping the same runtime ports and pooling resources across presentation, hiding and release. The generic runtime does not create Babylon meshes or shaders.

### Registered subtrees

An application may control the refinement of an implicit tileset region by region, by registering implicit subtrees with their own rules. The implicit resolver implements `subtreeAt`: for each tile the tileset makes available, before the tile is created, it returns the subtree registered at that tile, or nothing.

- From the registered tile down, the subtree replaces the rules of the tileset: its `implicitTiling`, hence its own levels and availability, its content templates, its resolver and its subtree loader. Its root tile takes the place of the registered tile, contents included.
- A subtree may stop the refinement early, with fewer levels; make tiles unavailable, through its availability; supply other contents, such as grids and textures of the application; or refine deeper than the tileset.
- The resolver of a subtree is asked for the subtrees registered inside it, so subtrees nest; the deepest one containing a tile applies there. Without its own resolver or loader, a subtree uses those of the tileset.
- A subtree replaces a tile the tileset makes available. Its root is a tile of the tileset, never the root of an implicit tileset, which the tileset itself defines.
- Quadtree balancing, the content ports and the spatial metric see the tiles of a subtree like any other: through `addressOf`, a subtree resolver locates its tiles in the shared pyramid.
- A subtree that stops the refinement early also bounds its neighbours: the quadtree balance keeps them within one level of its deepest tiles.

### Quadtree balance

Screen-space-error refinement decides each tile on its own, so two neighbouring branches can be displayed several levels apart, for example close to a grazing camera. Terrain grids can only connect edges one level apart. With `quadtreeBalance`, the runtime keeps the displayed tiles of implicit QUADTREE tilesets within one level of their edge neighbours (2:1 balance):

1. each frame starts from the screen-space error selection. For each selected tile of level `L` and each edge neighbour at level `L`, every ancestor of that neighbour at level `L - 2` or coarser is marked for refinement;
2. the traversal is repeated, refining the marked tiles even when their screen-space error does not require it. Marks only accumulate within a frame, so the passes converge, and a refinement that unbalances further neighbours is resolved by the next pass;
3. a marked tile whose children are not ready keeps the finer tiles already displayed in its place rather than falling back to a coarser ready tile, and its children load before any tile chosen by screen-space error alone;
4. when a tile still sits next to one two or more levels coarser, because that neighbour cannot refine yet, a new refinement waits: an ancestor of the fine tile stays displayed instead, the one a level above the neighbour or else the one at the neighbour's level, whichever is ready first, and the traversal is repeated. The refinement resumes in the frame where the neighbour's children are ready. A refinement already displayed at the start of the frame never waits: coarsening it would flicker, typically when a coarse neighbour comes into view as the camera turns, and the edge stays reported until the neighbour's children, loaded first, are ready.

A jump of two levels can only remain while the neighbour's children load, either before the first loads or when a coarse neighbour comes into view next to a displayed refinement. Such edges are identified: `IRuntimeFrameResult.unbalanced` lists the finer tile and the level of its coarse neighbour, a `quadtree-imbalance` event announces them, and `nodes.unbalanced` counts them in the runtime statistics, so that an adapter can hide them, for example with skirts on those edges only.

Diagonal neighbours do not constrain a tile, because tile corners exist at every level. Neighbours follow the `TileNeighbor` layout of `@spacexr/tiles`. When the implicit resolver implements `addressOf`, as `ImplicitTilesetDecorator` does, tiles are located in the pyramid shared by several implicit tilesets and balanced across their roots; `wrapX` also connects the antimeridian of a global pyramid. Otherwise each implicit tileset is balanced on its own coordinates. Explicit tilesets have no neighbour definition and are not balanced.

With the `fillGaps` option, a tile that the balance must refine, and whose children are not ready, keeps its displayed descendants only when they cover every visible part of it. Otherwise it falls back to a ready tile like any other refinement: an edge waiting for its balance, reported in `unbalanced`, is better than an empty part of the view.

### Turning the camera

A REPLACE refinement shows the children of a tile only once every visible child is ready. Children outside the view are not required to display a refinement. With `preloadSiblings`, enabled by default, the children of every refined tile that lie outside the view are loaded in the background, at a quarter of their screen-space error as priority, so that they enter the view ready when the camera turns. Their own descendants are not loaded. Without it, a child entering the view is not ready, and the whole refined area falls back to the ready ancestor until it loads, then refines again; an application may turn it off to save the loads of tiles that may never enter the view. Zooming out widens the view the same way: the children of a refined tile that enter the view must be ready before it shows them, and without preloading the tile falls back to a coarser ready ancestor, dropping the finer tiles already displayed, until they load. The tiles on the path of a displayed tile never leave the cache, since each is on the replacement front of its parent.

A refinement required only by the quadtree balance ends as soon as the finer neighbour leaves the view, and a screen-space error close to the threshold dips under it while the camera moves. `refinementHysteresisRatio` lowers the threshold a refined tile must stay above; `coarseningDelayFrames`, 20 by default, adds a delay in frames: a refined tile coarsens only once nothing has required its refinement for that many consecutive frames.

A tile is **visible** when it is in the view of the camera, and **active** when the selection keeps it. A visible tile is always active. An active tile need not be visible. There are two peripheries, which complement each other: the scaled frustum, `ISpatialMetric.isInPeriphery` with `peripheryFrustumPlanes` of `IEcefCameraFrame`, and, with `preloadSiblings`, the neighbours. The neighbours of a visible tile of level `N` are the tiles of level `N` and finer that touch it, by an edge or a corner, through the topology of the quadtree balance, from the visible tiles of the previous frame. A tile without an address in a quadtree has no neighbours. The traversal stops at a tile that is not active: its whole hierarchy goes with it, and its ancestors do not depend on it. An active tile refines and merges by its screen-space error like a visible one, and stays selected when it leaves the view, so that a small move of the camera does not hide it and show it again. Outside the view, it refines only into children that stay active, and merges back otherwise. Only visibility decides what waits: a tile outside the view loads after those in view, never brings a coarser ancestor into the view while it loads, and takes no part in the quadtree balance.

Leaving the view cancels the loads of the tiles that leave the working set. A cancelled load does not count against `maxLoadAttempts`, which only bounds failures, and a load cancelled before it started returns its contents to the idle state, so that they are requested again when the tile comes back. The children of a refined tile are requested together: every visible child is collected even after one is found not ready.

## Hooks and specialization

`IRuntimeHooks` exposes before and after hooks for tileset loading, frame traversal, content loading, attachment, detachment, metadata resolution, glyph publication and selection changes. Hook failures are reported as runtime errors without corrupting the traversal.

Core algorithm methods are protected, so a specialized runtime may override traversal, replacement-front collection, selection, loading, presentation or metadata resolution when hooks are not sufficient.

## Metadata

Metadata is resolved per tileset document. This is important for external tilesets because group indexes, schemas and schema URIs belong to the document that declares the tile.

The resolver preserves these scopes separately:

1. tileset metadata;
2. implicit subtree metadata;
3. ancestor tile metadata;
4. current tile metadata;
5. content group metadata;
6. content metadata;
7. feature metadata extracted by the content adapter, including glTF structural metadata.

The runtime does not silently merge these scopes. The 3D Tiles specification does not define inheritance between them. Applications can query a semantic with an explicit precedence order through `MetadataResolver.findBySemantic`.

Each resolved entity records its `documentUri`. Ancestor metadata keeps the schema of the tileset document that declared the ancestor, even when traversal has entered an external tileset. Feature metadata may provide its own schema and source URI when it originates from glTF `EXT_structural_metadata`; otherwise it uses the current tileset schema as a fallback.

Resolution supports:

- inline schemas and external schemas through `IMetadataSchemaLoader`;
- class and property lookup;
- required-property diagnostics;
- enum validation;
- scalar, vector, matrix and array shape validation;
- integer component validation;
- `noData` and `default` handling;
- normalized integer values;
- scale and offset transforms;
- unknown classes and properties without dropping their raw values;
- invalid content group diagnostics;
- metadata events, hooks and telemetry.

For implicit property tables, `IImplicitMetadataDecoder` is called with the loaded subtree, its buffers, availability, schema and local coordinates. Its tile and content entities enter the same metadata resolution pipeline. This keeps binary table decoding replaceable while preserving metadata scopes and schema ownership in the runtime.

The resolved `IMetadataSnapshot` is passed to content attachment and glyph publication. A GeoModels adapter can therefore derive BUSINESS MODEL entities, durable anchors, labels, styles or investor-view glyphs without putting those concepts in the generic 3D Tiles runtime.

## Current boundary

The generic runtime owns traversal, availability and resource lifecycle. Web tile addressing, tile pyramids and HTTP tile sources live in the renderer-neutral `@spacexr/tiles` package, rasters in `@spacexr/raster` and DEM decoding and surfaces in `@spacexr/dem`, which adapters call from their activation port. Rendering, glTF decoding, terrain grid creation, shader selection and engine-specific resource pooling remain responsibilities of an adaptation package such as `@spacexr/3d-tiles-babylon`, maintained in [3d-tiles-babylon](https://github.com/pandaGaume/3d-tiles-babylon).

## Cube tilesets

The runtime source of a whole body on the [cube index](celestial-tiling.md), `createCubeImplicitSource`, is on the `experimental/cube` branch until it is validated. The cube addressing, its topology and the reprojection of `@spacexr/tiles` stay here.

## Base selection for runtime owned geometry

`selectionStrategy: "base"` uses the same visible/SSE traversal for explicit and implicit tilesets and for every rendering backend. `ADD` keeps its additive semantics. `REPLACE` prepares the first content front of every available child, including hidden siblings, before replacing its parent. Hidden siblings are prepared without recursively refining them. A known empty leaf contributes no content and does not force its ready siblings back to their parent.

This strategy selects from the view alone: it keeps no tile for a second activity frustum or a ring of neighbours from the previous frame. When the metric has a periphery, `ISpatialMetric.isInPeriphery`, the tiles of the periphery and their descendants down to the threshold are loaded without being selected, so that a place entering the view finds its tile ready. Requests, cached content and the published selection are separate. Ready coverage ancestors stay protected while their descendants are selected. Only a complete ready coverage of the visible domain may replace a fallback.

When quadtree balancing is enabled, one visible traversal is followed by a local edge queue that refines ready support neighbours before admission. A displayed tile at level N is never coarsened to admit a new neighbour: that neighbour must be ready at level N-1 or finer. A ready tile is displayable only when its edges stay within one level of the cut. A new tile that is not displayable, because the support it needs is still preparing, is not published: the place it covers keeps what was displayed there, the displayed ancestor it refines or the displayed tiles it would coarsen, and the rest of the cut is published. Every new tile involved in the refused edge waits, including the tiles split to support it. Coarsening requested by SSE also waits when it would create an incompatible edge. When only displayed tiles are involved, the runtime retains the previous ready cut and its resources. The published terrain cut always has at most one geometric LOD of difference across an edge. A place that displayed nothing, such as a newly exposed region, still requires its own displayable content.

The terrain source exposes geometric availability independently of the physical DEM. A deeper geometric tile may prepare its content from a sub-area of a measured ancestor or from generated heights. The DEM and imagery adapters own their availability, interpolation and cache identities; the generic runtime does not create DEM pages or request nonexistent source levels.

The `active` strategy remains the default for existing integrations during migration. The Mercator example explicitly uses `base` for both CPU and GPU.
