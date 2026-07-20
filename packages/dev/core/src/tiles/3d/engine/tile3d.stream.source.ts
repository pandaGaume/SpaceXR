import { ICameraViewState } from "../../../camera";
import { Observable } from "../../../events";
import { Ellipsoid } from "../../../geodesy";
import { Bounds } from "../../../geometry/geometry.bounds";
import { IBounds, IBoundingBox, IBoundingSphere } from "../../../geometry/geometry.interfaces";
import { IPipelineMessageType } from "../../pipeline";
import { IStreamActiveEntry, StreamActiveContext } from "../../../streaming/streaming.active.context";
import { IStreamSource, StreamSourceStatus } from "../../../streaming/streaming.datasource.interfaces";
import { IntersectsBoundingBox, StreamingEngine } from "../../../streaming/streaming.engine";
import { IStreamSubEngine } from "../../../streaming/streaming.subengine.interfaces";
import { IScreenSpaceErrorBudget, ResolveSSEBudget } from "../../../streaming/streaming.visibility.budget";
import { DefaultScreenSpaceErrorFn } from "../../../streaming/streaming.visibility.overflight";
import { IOctreeNode } from "../../../tree/tree.octree.interfaces";
import { Nullable } from "../../../types";
import { PathUtils } from "../../../utils";
import { BoxType, CreateTileSphereFromBox, ITile3d, ITileset, SphereType } from "../interfaces";
import { IDENTITY44, IsSphereInFrustum, IsTileSphereBeyondHorizon, Mat44MultToRef, Mat44Type, TransformBoxToRef, TransformSphereToRef } from "../interfaces/math/math";
import { RegionToBoxECEF } from "../interfaces/math/region";
import { MaxScreenSpaceErrorFn, Tile3dMaxPriority, Tile3dMinPriority, Tile3dNormalPriority, Tile3dRefineType, TileContentStatus } from "./tile3d.stream.engine";

/**
 * Minimal contract to fetch and decode a tileset JSON document. Satisfied by
 * ITile3dContentLoader implementations (e.g. the Babylon Tile3dContentLoader)
 * and by thin wrappers over TilesetClient.
 */
export interface ITilesetLoader {
    loadTileSetAsync(uri: string): Promise<Nullable<ITileset>>;
}

/** contentType of the Tile3dStreamSource aggregate itself. */
export const TILE3D_TILESET_CONTENT_TYPE = "tile3d-tileset";
/** Default contentType of the per-tile stream sources it emits. */
export const TILE3D_NODE_CONTENT_TYPE = "tile3d-node";

/**
 * Engine-runtime augmentation added by the sub-engine (completes the fields
 * declared by tile3d.stream.engine.ts).
 *
 * COORDINATE CONVENTION: `worldBoundingVolume`, `worldAabb` and `worldSphere`
 * written by Tile3dStreamSource are in RAW ECEF (right-handed, Z-up, meters,
 * planet centre at the origin). This matches the GeodeticCamera /
 * BABYLON.GeospatialCamera convention where Babylon world coordinates ARE the
 * ECEF coordinates numerically. (The deprecated Tile3dStreamEngine instead
 * stored volumes remapped to the Babylon basis; do not mix both engines on
 * one tree.)
 */
declare module "../interfaces/tile3d" {
    interface ITile3d {
        /** Stable id assigned at initialization: `<sourceId>/<childIndex>/…`. */
        uid?: string;
        /** True when at least one content uri points to renderable (non-tileset) data. */
        hasContent?: boolean;
        /** REPLACE gate: content may only be presented when true (set by the traversal). */
        renderable?: boolean;
        /** Lifecycle of external (.json) tileset grafting for this tile. */
        externalStatus?: TileContentStatus;
        /** Graft attempts so far (bounded by Tile3dStreamSource.MaxLoadAttempts). */
        externalAttempts?: number;
        /** Content fetch attempts so far (bounded by Tile3dStreamSource.MaxLoadAttempts). */
        contentAttempts?: number;
        /** Axis-aligned bounds of the world bounding volume, raw ECEF. */
        worldAabb?: IBounds;
        /** World bounding sphere (object form), raw ECEF. */
        worldSphere?: IBoundingSphere;
        /** geometricError scaled by the transform chain's maximum scale factor (spec). */
        worldGeometricError?: number;
    }
}

/** Maximum scale factor of the upper 3x3 of a column-major matrix. */
function MaxScaleFactor(m: Mat44Type): number {
    const sx = Math.hypot(m[0], m[1], m[2]);
    const sy = Math.hypot(m[4], m[5], m[6]);
    const sz = Math.hypot(m[8], m[9], m[10]);
    return Math.max(sx, sy, sz);
}

function AabbFromBox(b: BoxType): IBounds {
    const ex = Math.abs(b[3]) + Math.abs(b[6]) + Math.abs(b[9]);
    const ey = Math.abs(b[4]) + Math.abs(b[7]) + Math.abs(b[10]);
    const ez = Math.abs(b[5]) + Math.abs(b[8]) + Math.abs(b[11]);
    return new Bounds(b[0] - ex, b[1] - ey, 2 * ex, 2 * ey, b[2] - ez, 2 * ez);
}

function AabbFromSphere(s: SphereType): IBounds {
    const r = s[3];
    return new Bounds(s[0] - r, s[1] - r, 2 * r, 2 * r, s[2] - r, 2 * r);
}

/**
 * IStreamSource wrapper over one ITile3d node. Cached per tile by the
 * sub-engine so the id / instance stay stable across traversals (the parent
 * engine diffs its cut by id).
 *
 * `status` derives from the tile's load + render-gate state: a tile whose
 * content is fetched but whose sibling set is not yet complete reports
 * `loading`, so scenes that render only `ready` sources naturally implement
 * hole-free REPLACE refinement.
 */
export class Tile3dNodeSource implements IStreamSource<ITile3d> {
    public readonly kind = "static" as const;
    public readonly contentType: string;
    public readonly tile: ITile3d;
    public content?: ITile3d | null;

    public constructor(tile: ITile3d, contentType: string = TILE3D_NODE_CONTENT_TYPE) {
        this.tile = tile;
        this.content = tile;
        this.contentType = contentType;
    }

    public get id(): string {
        return this.tile.uid ?? "";
    }

    public get encumbrance(): IBoundingBox | IBoundingSphere {
        return this.tile.worldAabb ?? this.tile.worldSphere ?? Bounds.Zero();
    }

    public get boundingBox(): IBounds | undefined {
        return this.tile.worldAabb;
    }

    public get boundingSphere(): IBoundingSphere | undefined {
        return this.tile.worldSphere;
    }

    /** Geometric error in meters (transform-scaled). */
    public get geometricError(): number {
        return this.tile.worldGeometricError ?? this.tile.geometricError ?? 0;
    }

    public get status(): StreamSourceStatus {
        const t = this.tile;
        if (!t.hasContent) return StreamSourceStatus.ready; // structural node: nothing to fetch
        switch (t.contentStatus) {
            case TileContentStatus.ready:
                return t.renderable === false ? StreamSourceStatus.loading : StreamSourceStatus.ready;
            case TileContentStatus.error:
                return StreamSourceStatus.error;
            case TileContentStatus.loading:
                return StreamSourceStatus.loading;
            case TileContentStatus.pending:
                return StreamSourceStatus.pending;
            default:
                return StreamSourceStatus.idle;
        }
    }

    /** Status is derived (see getter); external writes are ignored. */
    public set status(_value: StreamSourceStatus) {
        /* derived */
    }
}

export interface ITile3dStreamSourceOptions {
    /** Unique id; also the namespace prefix of every emitted tile id. */
    id: string;
    /** Root tileset uri (credential injection happens inside the tilesetLoader). */
    uri: string;
    /** Loads tileset JSON documents (root + external references). */
    tilesetLoader: ITilesetLoader;
    /**
     * Max pixel screen-space error before a tile is refined. A number for a
     * constant threshold or an IScreenSpaceErrorBudget for altitude-varying
     * thresholds. Defaults to a constant 16.
     */
    maxScreenSpaceError?: number | IScreenSpaceErrorBudget;
    /** Per-depth max-SSE override (e.g. GoogleTile3dErrorFn). Wins over `maxScreenSpaceError` when provided. */
    maxScreenSpaceErrorFn?: MaxScreenSpaceErrorFn;
    /** Planet used for horizon culling and the altitude fed to the SSE budget. Defaults to WGS84. */
    ellipsoid?: Ellipsoid;
    /** Enable horizon-occlusion culling. Defaults to true. */
    horizonCull?: boolean;
    /** Ellipsoid used to convert region bounding volumes. Defaults to `ellipsoid`. */
    regionEllipsoid?: Ellipsoid;
    /** Override the aggregate contentType. */
    contentType?: string;
    /** contentType applied to each emitted Tile3dNodeSource. Default "tile3d-node". */
    childContentType?: string;
    maxRefinePerFrame?: number;
    maxCoarsenPerFrame?: number;
    minFramesBeforeCoarsen?: number;
}

/**
 * OGC 3D Tiles as an IStreamSubEngine: the 3D Tiles peer of
 * TilePyramidStreamSource. It walks the materialized tileset tree with
 * frustum + horizon + screen-space-error tests and emits one
 * `Tile3dNodeSource` per tile of the current cut. Coarsening falls out of the
 * parent StreamingEngine diff (tiles that leave the desired set are dequeued
 * through `coarsenPQ` under budget).
 *
 * Behaviour:
 *  - REPLACE refinement is hole-free: a parent stays in the cut (and its
 *    children are emitted load-gated) until every visible descendant of the
 *    replacement front is fetched, then the swap happens in a single frame.
 *  - ADD refinement emits parents and children together.
 *  - External tilesets (`content.uri` ending in .json) are grafted lazily the
 *    first time refinement needs them, then traversal resumes.
 *  - Tiles without renderable content are structural: traversal passes
 *    through them without emitting.
 *
 * Drive it per frame with `setContext(viewId, cameraViewState, clipBounds?)`,
 * or through a parent StreamingEngine. Call `invalidate()` when tile content
 * finishes loading (Tile3dStreamBinding does this automatically).
 *
 * Known v1 limits: the REPLACE render gate is shared across views (correct
 * for a single view); `viewerRequestVolume` is not honored; implicit tiling
 * and binary tile formats are out of scope.
 */
export class Tile3dStreamSource extends StreamingEngine implements IStreamSubEngine<IStreamSource<unknown>> {
    public static readonly DefaultMaxScreenSpaceError = 16;
    /** Fetch attempts per document before giving up (root tileset and external grafts). */
    public static readonly MaxLoadAttempts = 3;

    // IStreamSource -------------------------------------------------
    public readonly id: string;
    public readonly kind = "provider" as const;
    public readonly contentType: string;
    public encumbrance: IBoundingBox | IBoundingSphere;
    public status: StreamSourceStatus = StreamSourceStatus.idle;
    /** The tileset is an aggregate; content is always null. */
    public content?: IStreamSource<unknown> | null = null;
    public boundingBox?: IBounds;
    public boundingSphere?: IBoundingSphere;

    private readonly _uri: string;
    private readonly _baseUri: string;
    private readonly _tilesetLoader: ITilesetLoader;
    private readonly _budget: IScreenSpaceErrorBudget;
    private readonly _maxSSEFn?: MaxScreenSpaceErrorFn;
    private readonly _planetRadius: number;
    private readonly _occluderRadius: number;
    private readonly _horizonCull: boolean;
    private readonly _regionEllipsoid: Ellipsoid;
    private readonly _childContentType: string;

    private _root: Nullable<ITileset> = null;
    private _rootPromise: Nullable<Promise<void>> = null;
    private _rootAttempts: number = 0;
    private _rootReadyObservable?: Observable<ITileset>;
    private readonly _sources: Map<ITile3d, Tile3dNodeSource> = new Map();
    private readonly _renderStateChanged: Array<ITile3d> = [];

    public constructor(options: ITile3dStreamSourceOptions) {
        super({
            maxRefinePerFrame: options.maxRefinePerFrame,
            maxCoarsenPerFrame: options.maxCoarsenPerFrame,
            minFramesBeforeCoarsen: options.minFramesBeforeCoarsen,
        });
        this.id = options.id;
        this.contentType = options.contentType ?? TILE3D_TILESET_CONTENT_TYPE;
        this.encumbrance = Bounds.Zero();
        this._uri = options.uri;
        this._baseUri = PathUtils.GetBaseUrl(options.uri);
        this._tilesetLoader = options.tilesetLoader;
        this._budget = ResolveSSEBudget(options.maxScreenSpaceError ?? Tile3dStreamSource.DefaultMaxScreenSpaceError);
        this._maxSSEFn = options.maxScreenSpaceErrorFn;
        const ellipsoid = options.ellipsoid ?? Ellipsoid.WGS84;
        this._planetRadius = ellipsoid.semiMajorAxis;
        this._occluderRadius = Math.min(ellipsoid.semiMajorAxis, ellipsoid.semiMinorAxis);
        this._horizonCull = options.horizonCull ?? true;
        this._regionEllipsoid = options.regionEllipsoid ?? ellipsoid;
        this._childContentType = options.childContentType ?? TILE3D_NODE_CONTENT_TYPE;
    }

    /** Notifies once when the root tileset document is parsed and linked. */
    public get rootReadyObservable(): Observable<ITileset> {
        if (!this._rootReadyObservable) this._rootReadyObservable = new Observable<ITileset>();
        return this._rootReadyObservable;
    }

    public get rootTileset(): Nullable<ITileset> {
        return this._root;
    }

    /**
     * Re-runs the traversal of every active view with its last camera state.
     * Call whenever an async event (content loaded, external tileset grafted)
     * changes what the traversal would select; camera movement does not need
     * it (setContext already refreshes).
     */
    public invalidate(): void {
        for (const [viewId, ctx] of this._views) {
            if (ctx.camera) this._refresh(viewId, ctx);
        }
    }

    public override dispose(): void {
        super.dispose();
        this._sources.clear();
        this._rootReadyObservable?.clear();
    }

    /**
     * Closes the render gate of every tile leaving the cut before announcing
     * the removal.
     *
     * Without this, a tile coarsened out while its content was still in
     * flight would keep `renderable === true`; when the fetch later settles,
     * the sink would present geometry the engine no longer selects, and no
     * further removal would ever fire for it (the cut exit already happened).
     */
    public override notifyRemoved(eventData: IPipelineMessageType<IStreamSource<unknown>>, mask?: number, target?: unknown, currentTarget?: unknown, userInfo?: unknown): boolean {
        for (const s of eventData) {
            const tile = (s as Tile3dNodeSource)?.tile;
            if (tile) tile.renderable = false;
        }
        return super.notifyRemoved(eventData, mask, target, currentTarget, userInfo);
    }

    // ───────── traversal ─────────

    protected override _refresh(viewId: string, ctx: StreamActiveContext): void {
        this._renderStateChanged.length = 0;
        super._refresh(viewId, ctx);
        if (this._renderStateChanged.length) {
            const updated: Array<IStreamSource<unknown>> = [];
            for (const t of this._renderStateChanged) {
                const s = this._sources.get(t);
                if (s) updated.push(s);
            }
            this._renderStateChanged.length = 0;
            if (updated.length) this.notifyUpdated(updated, -1, this, this);
        }
    }

    protected override _traverse(
        camera: ICameraViewState,
        ctx: StreamActiveContext,
        _parentsOut: Set<IOctreeNode<IStreamSource>>,
        _frontierOut: Set<IOctreeNode<IStreamSource>>,
        entriesOut: Map<string, IStreamActiveEntry>
    ): void {
        if (!this._root) {
            this._ensureRoot();
            return;
        }
        const rootTile = this._root.root;
        if (!rootTile) return;
        const maxSSE = this._budget.getMaxSSE(this._cameraAltitude(camera));
        this._visit(rootTile, camera, ctx.clipBounds, maxSSE, entriesOut);
    }

    private _visit(tile: ITile3d, camera: ICameraViewState, clip: IBoundingBox | undefined, maxSSE: number, out: Map<string, IStreamActiveEntry>): void {
        if (!this._isVisible(tile, camera, clip)) return;

        const sse = this._computeSSE(tile, camera);
        tile.sse = sse;
        const effMaxSSE = this._maxSSEFn?.(tile.depth) ?? maxSSE;
        const children = tile.children;
        const hasChildren = !!(children && children.length);

        // Structural tiles must always try to reach renderable descendants.
        const wantRefine = sse > effMaxSSE || !tile.hasContent;

        if (wantRefine && tile.hasExternal && !hasChildren) {
            // Refinement requires the external tileset; graft it, render own
            // content (if any) meanwhile.
            this._maybeLoadExternal(tile);
            this._emitIfRenderable(tile, sse, out);
            return;
        }

        if (!wantRefine || !hasChildren) {
            this._emitIfRenderable(tile, sse, out);
            return;
        }

        if (tile.refineType === Tile3dRefineType.add) {
            // Additive refinement: parent and children accumulate.
            this._emitIfRenderable(tile, sse, out);
            for (const c of children!) this._visit(c, camera, clip, maxSSE, out);
            return;
        }

        // REPLACE refinement, hole-free: descend only once the whole visible
        // replacement front is fetched; until then keep the parent and stream
        // the front in load-gated state.
        const front: Array<ITile3d> = [];
        let ready = true;
        for (const c of children!) {
            if (!this._collectFront(c, camera, clip, front)) ready = false;
        }
        if (ready) {
            for (const c of children!) this._visit(c, camera, clip, maxSSE, out);
            return;
        }
        this._emitIfRenderable(tile, sse, out);
        for (const f of front) {
            this._emit(f, this._computeSSE(f, camera), out, false);
        }
    }

    /**
     * Walks a REPLACE front rooted at `c`: pushes every visible renderable
     * node into `front` and reports whether the whole front is fetched.
     * Structural nodes recurse; external references are kicked off and count
     * as not-ready until grafted.
     */
    private _collectFront(c: ITile3d, camera: ICameraViewState, clip: IBoundingBox | undefined, front: Array<ITile3d>): boolean {
        if (!this._isVisible(c, camera, clip)) return true; // culled: contributes nothing

        // A failed fetch reports NOT ready on purpose: the swap is held back so
        // the parent keeps covering the footprint with coarse geometry. Letting
        // the swap proceed would drop the parent and leave a permanent hole,
        // since an errored tile has no content to render.
        if (c.hasExternal && !c.children?.length) {
            this._maybeLoadExternal(c);
            if (c.hasContent) front.push(c);
            return false;
        }

        if (c.hasContent) {
            front.push(c);
            return c.contentStatus === TileContentStatus.ready;
        }

        if (c.children?.length) {
            let ready = true;
            for (const k of c.children) {
                if (!this._collectFront(k, camera, clip, front)) ready = false;
            }
            return ready;
        }
        return true; // empty leaf
    }

    private _emitIfRenderable(tile: ITile3d, priority: number, out: Map<string, IStreamActiveEntry>): void {
        if (tile.hasContent) this._emit(tile, priority, out, true);
    }

    private _emit(tile: ITile3d, priority: number, out: Map<string, IStreamActiveEntry>, renderable: boolean): void {
        if (tile.renderable !== renderable) {
            tile.renderable = renderable;
            this._renderStateChanged.push(tile);
        }
        // Fetch order follows visual urgency: the loader reads `priority` when
        // the tile is enqueued, highest first.
        tile.priority = Math.max(Tile3dMinPriority, Math.min(Tile3dMaxPriority, Math.round(priority)));
        let src = this._sources.get(tile);
        if (!src) {
            src = new Tile3dNodeSource(tile, this._childContentType);
            this._sources.set(tile, src);
        }
        out.set(src.id, { source: src, priority, activatedFrame: -1, lastSeenFrame: -1 });
    }

    // ───────── visibility / error metrics ─────────

    private _isVisible(tile: ITile3d, camera: ICameraViewState, clip: IBoundingBox | undefined): boolean {
        const aabb = tile.worldAabb;
        if (clip && aabb && !IntersectsBoundingBox(aabb, clip)) return false;

        const sphere = tile.worldBoundingVolume?.sphere;
        if (this._horizonCull && this._occluderRadius > 0 && sphere) {
            // Occluder = the ellipsoid's SMALLEST radius: a sphere that size is
            // fully inside the planet, so the horizon test can never cull a
            // tile that is actually visible.
            if (IsTileSphereBeyondHorizon(sphere, camera.worldPosition, this._occluderRadius)) return false;
        }
        if (camera.isInFrustum && aabb) return camera.isInFrustum(aabb);
        if (camera.frustumPlanes && sphere) return IsSphereInFrustum(sphere, camera.frustumPlanes);
        return true;
    }

    private _computeSSE(tile: ITile3d, camera: ICameraViewState): number {
        const ge = tile.worldGeometricError ?? tile.geometricError ?? 0;
        if (ge <= 0) return 0;
        let distance = 1;
        const s = tile.worldSphere;
        if (s) {
            const dx = s.center.x - camera.worldPosition.x;
            const dy = s.center.y - camera.worldPosition.y;
            const dz = s.center.z - camera.worldPosition.z;
            distance = Math.max(Math.hypot(dx, dy, dz) - s.radius, 1e-6);
        }
        const tan = camera.tanFov2 > 0 ? camera.tanFov2 : Math.tan((camera.fovY || 0) * 0.5);
        const vh = camera.viewportHeight && camera.viewportHeight > 0 ? camera.viewportHeight : 1080;
        return DefaultScreenSpaceErrorFn(ge, distance, vh, tan);
    }

    /** Camera altitude above the planet surface (raw ECEF, planet at origin). */
    private _cameraAltitude(camera: ICameraViewState): number {
        if (this._planetRadius <= 0) return 0;
        const p = camera.worldPosition;
        return Math.max(Math.hypot(p.x, p.y, p.z) - this._planetRadius, 0);
    }

    // ───────── tree initialization ─────────

    private _ensureRoot(): void {
        if (this._rootPromise) return;
        if (this._rootAttempts >= Tile3dStreamSource.MaxLoadAttempts) return;
        this._rootAttempts++;
        this.status = StreamSourceStatus.loading;
        this._rootPromise = this._tilesetLoader
            .loadTileSetAsync(this._uri)
            .then((ts) => {
                if (!ts?.root) {
                    this.status = StreamSourceStatus.error;
                    this._rootPromise = null; // let the next traversal retry
                    return;
                }
                this._initializeTile(ts.root, undefined, this._baseUri, 0);
                this._root = ts;
                const rootTile = ts.root;
                if (rootTile.worldAabb) {
                    this.boundingBox = rootTile.worldAabb;
                    this.encumbrance = rootTile.worldAabb;
                }
                if (rootTile.worldSphere) this.boundingSphere = rootTile.worldSphere;
                this.status = StreamSourceStatus.ready;
                this._rootReadyObservable?.notifyObservers(ts, -1, this, this);
                this.invalidate();
            })
            .catch(() => {
                this.status = StreamSourceStatus.error;
                // Transient failures (offline blip, 503, resolver token not
                // ready) must not brick the source: the next traversal retries,
                // up to MaxLoadAttempts.
                this._rootPromise = null;
            });
    }

    private _maybeLoadExternal(tile: ITile3d): void {
        // Retry failed grafts on a later traversal, up to MaxLoadAttempts.
        if (tile.externalStatus !== undefined && tile.externalStatus !== TileContentStatus.error) return;
        if (tile.externalStatus === TileContentStatus.error) {
            if ((tile.externalAttempts ?? 0) >= Tile3dStreamSource.MaxLoadAttempts) return;
        }
        tile.externalAttempts = (tile.externalAttempts ?? 0) + 1;
        const jsonContents = (tile.contents ?? []).filter((c) => c.uri && PathUtils.EndsWith(c.uri, ".json"));
        if (!jsonContents.length) {
            tile.externalStatus = TileContentStatus.error;
            return;
        }
        tile.externalStatus = TileContentStatus.loading;
        Promise.all(
            jsonContents.map(async (c) => {
                const ts = await this._tilesetLoader.loadTileSetAsync(c.uri);
                if (ts?.root) {
                    const index = tile.children?.length ?? 0;
                    this._initializeTile(ts.root, tile, PathUtils.GetBaseUrl(c.uri), index);
                    if (!tile.children) {
                        tile.children = [ts.root];
                    } else {
                        tile.children.push(ts.root);
                    }
                } else {
                    throw new Error(`External tileset "${c.uri}" is empty or invalid.`);
                }
            })
        )
            .then(() => {
                tile.externalStatus = TileContentStatus.ready;
                this.invalidate();
            })
            .catch(() => {
                tile.externalStatus = TileContentStatus.error;
                this.invalidate();
            });
    }

    /**
     * Recursive tile initialization: parent link, uid, depth, refine
     * inheritance, world transform chain, transform-scaled geometric error,
     * world bounding volumes (raw ECEF) and absolute content uris.
     *
     * `baseUri` is the base of the tileset document DECLARING the tile, so
     * relative uris inside external tilesets resolve against their own
     * document (not the root's).
     */
    private _initializeTile(tile: ITile3d, parent: ITile3d | undefined, baseUri: string, index: number): void {
        tile.parent = parent;
        tile.uid = parent ? `${parent.uid}/${index}` : this.id;
        tile.contentStatus = TileContentStatus.idle;
        tile.priority = Tile3dNormalPriority;
        tile.depth = parent ? parent.depth + 1 : 0;
        tile.renderable = false;
        tile.sse = 0;

        if (parent?.worldTransform || tile.transform) {
            const parentTransform = parent?.worldTransform ?? IDENTITY44;
            const localTransform = tile.transform ?? IDENTITY44;
            tile.worldTransform = new Float64Array(16);
            Mat44MultToRef(parentTransform, localTransform, tile.worldTransform);
        }

        // refine inherits from the parent (spec); the root defaults to REPLACE.
        if (tile.refine === "ADD") tile.refineType = Tile3dRefineType.add;
        else if (tile.refine === "REPLACE") tile.refineType = Tile3dRefineType.replace;
        else tile.refineType = parent?.refineType ?? Tile3dRefineType.replace;

        // The transform chain scales geometricError by its maximum scale factor (spec).
        const scale = tile.worldTransform ? MaxScaleFactor(tile.worldTransform) : 1;
        tile.worldGeometricError = (tile.geometricError ?? 0) * scale;

        this._initializeWorldVolume(tile);

        if (tile.content) {
            tile.contents = tile.contents ?? [];
            tile.contents.push(tile.content);
            tile.content = undefined;
        }
        tile.hasExternal = false;
        tile.hasContent = false;
        if (tile.contents) {
            for (const c of tile.contents) {
                if (!c.uri) continue;
                c.uri = PathUtils.IsRelativeUrl(c.uri) ? PathUtils.ResolveUri(baseUri, c.uri) : c.uri;
                if (PathUtils.EndsWith(c.uri, ".json")) tile.hasExternal = true;
                else tile.hasContent = true;
            }
        }

        if (tile.children) {
            for (let i = 0; i < tile.children.length; i++) {
                this._initializeTile(tile.children[i], tile, baseUri, i);
            }
        }
    }

    /**
     * Computes the tile's world bounding volumes in RAW ECEF: box / sphere
     * volumes go through the tile's world transform (the spec applies
     * `transform` to them), regions are already geodetic and ignore it.
     */
    private _initializeWorldVolume(tile: ITile3d): void {
        const bv = tile.boundingVolume;
        let box: BoxType | undefined;
        let sphere: SphereType | undefined;
        if (bv) {
            if (bv.box) {
                box = bv.box.slice(0, 12) as unknown as BoxType;
                if (tile.worldTransform) TransformBoxToRef(bv.box, tile.worldTransform, box);
                sphere = CreateTileSphereFromBox(box);
            } else if (bv.region) {
                box = RegionToBoxECEF(bv.region, this._regionEllipsoid);
                sphere = CreateTileSphereFromBox(box);
            } else if (bv.sphere) {
                sphere = bv.sphere.slice(0, 4) as unknown as SphereType;
                if (tile.worldTransform) TransformSphereToRef(bv.sphere, tile.worldTransform, sphere);
            }
        }
        tile.worldBoundingVolume = { box, sphere };
        if (sphere) {
            tile.worldSphere = { center: { x: sphere[0], y: sphere[1], z: sphere[2] }, radius: sphere[3] };
        }
        tile.worldAabb = box ? AabbFromBox(box) : sphere ? AabbFromSphere(sphere) : undefined;
    }
}
