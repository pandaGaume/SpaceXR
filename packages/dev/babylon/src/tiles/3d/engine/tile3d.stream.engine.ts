import { Nullable } from "core/types";
import { ICameraViewState, IDisplay, IHasDisplay, IPipelineMessageType, ISourceBlock, ITargetBlock, SourceBlock } from "core/tiles";
import { Cartesian3 } from "core/geometry";
import { PriorityQueue } from "core/collections";
import { WebClient } from "core/io";
import { PathUtils } from "core/utils";

import { BoxType, CreateTileSphereFromBox, GetTile3dContents, IBoundingVolume, IsITileset, ITile3d, ITileset, SphereType } from "../interfaces";
import { EcefBoxToBjsInPlace, EcefSphereToBjsInPlace, IDENTITY44, IsSphereInFrustum, IsTileSphereBeyondHorizon, Mat44MultToRef, Mat44Type } from "../interfaces/math/math";
import { EventState, Observable } from "core/events";
import { Ellipsoid } from "core/geodesy";

export const Tile3dMinPriority: number = 0;
export const Tile3dNormalPriority: number = 30;
export const Tile3dMaxPriority: number = 100;

/**
 * Enumeration for the refinement strategy used when traversing the object hierarchy for rendering.
 * - `add`: Children are added to the current set of rendered objects (additive refinement).
 * - `replace`: Children replace the current object (replacement refinement).
 * - `unknown`: The refinement strategy is not specified or is implementation dependent.
 */
export enum Tile3dRefineType {
    add,
    replace,
    unknown = 999,
}

/**
 * Function signature for computing the screen space error (SSE) of a tile or object.
 *
 * @param tileGeometricError - The geometric error of the tile/object (in meters).
 * @param distanceToCamera - The distance from the tile/object to the camera (in meters).
 * @param viewportHeight - The height of the viewport (in pixels).
 * @param tanfov2 - The tangent of half the field of view (unitless).
 * @returns The screen space error, typically measured in pixels.
 */
export type ScreenSpaceErrorFn = (tileGeometricError: number, distanceToCamera: number, viewportHeight: number, tanfov2: number) => number;

/**
 * Computes the screen space error (SSE) for an object based on its geometric error,
 * the distance to the camera, the viewport height, and the tangent of half the field of view.
 *
 * @param tileGeometricError - The geometric error of the object (in meters).
 * @param distanceToCamera - The distance from the object to the camera (in meters).
 * @param viewportHeight - The height of the viewport (in pixels).
 * @param tanfov2 - The tangent of half the field of view (unitless).
 * @returns The screen space error, typically in pixels.
 */
export const DefaultScreenSpaceError: ScreenSpaceErrorFn = (tileGeometricError, distanceToCamera, viewportHeight, tanfov2) =>
    (tileGeometricError * viewportHeight) / (2 * distanceToCamera * tanfov2);

export interface IStreamableNode {}

export enum TileContentStatus {
    idle, // initialized
    pending, // queued fro loading
    loading, // loading (ie-network operation in progress)
    ready, // loaded, content ready
    error, // on error after network operation
    unkknown = 999,
}

/** Augmentation for the engine */
declare module "../interfaces/tile3d" {
    interface ITile3d extends IStreamableNode {
        contentStatus?: TileContentStatus;
        visible?: boolean;
        parent?: ITile3d;
        worldTransform?: Mat44Type; // ECEF world transform
        refineType?: Tile3dRefineType; // refine type enum value
        depth: number; // the depth into the hierarchy
        worldBoundingVolume?: IBoundingVolume; // precomputed bounding box ECEF * world transform * ECEFToRH (x,z,-y) * RH2Babylon (-x)
        lastVisibleFrame?: number; // frame index for visibility aging
        lastUsedFrame?: number; // frame index for usage aging
        sse: number; // last computed SSE, updated per frame
        priority?: number; // request priority
        hasExternal?: boolean; // define that the tile is pointing to external data set.
    }
}

/** Augmentation for the engine */
declare module "../interfaces/tileset" {
    interface ITileset extends IStreamableNode {}
}

export interface IUriResolver {
    resolve(uri: string): string;
}

export type MaxScreenSpaceErrorFn = (level: number) => number;

export interface ITile3dStreamEngineContentOptions {
    ellipsoid?: Ellipsoid;

    uriResolver?: IUriResolver;

    /**
     * The maximum allowed screen-space error (SSE), in pixels,
     * before a object should be refined (loaded at higher LOD).
     * Typical values: 8–24 depending on visual quality requirements.
     */
    maxScreenSpaceError?: number;
    maxScreenSpaceErrorFn?: MaxScreenSpaceErrorFn;
}

export interface ITile3dStreamEngineOptions {
    client?: WebClient<string, ITileset>;

    /**
     * Optional fixed hysteresis offset, in pixels, applied when coarsening LOD.
     * This avoids constant refine/coarsen flicker when SSE is near the threshold.
     *
     * Example:
     *   If `maxScreenSpaceError = 16` and `hysteresisOffset = 2`,
     *   coarsening will only happen when SSE drops below 14.
     *
     * Precedence:
     *   If both `hysteresisOffset` and `hysteresisPercent` are provided,
     *   this fixed offset takes precedence over the percentage value.
     */
    hysteresisOffset?: number;

    /**
     * Optional hysteresis as a percentage of `maxScreenSpaceError`.
     * This is only applied if `hysteresisOffset` is not defined.
     *
     * Example:
     *   If `maxScreenSpaceError = 16` and `hysteresisPercent = 0.1` (10%),
     *   coarsening will only happen when SSE drops below 14.4.
     */
    hysteresisPercent?: number;

    /**
     * Optional function to compute the screen space error (SSE) for this engine.
     */
    screenSpaceError?: ScreenSpaceErrorFn;

    maxRefinePerFrame?: number;
    maxCoarsenPerFrame?: number;
}

export class ActiveContext {
    cut: Set<ITile3d>; // current render leaves
    parents: Set<ITile3d>; // ancestors of cut (for coarsen checks)
    frontier: Set<ITile3d>; // neighbors/children probables
    refinePQ: PriorityQueue<ITile3d>; // ordered by sse (desc)
    coarsenPQ: PriorityQueue<ITile3d>; // ordered by sse (asc)

    public constructor(data?: ITile3d | Iterable<ITile3d>) {
        if (!data) {
            this.cut = new Set<ITile3d>();
        } else if (Array.isArray(data)) {
            this.cut = new Set<ITile3d>(data);
        } else if (typeof (data as any)[Symbol.iterator] === "function") {
            // generic iterable (e.g. Set, Map keys, etc.)
            this.cut = new Set<ITile3d>(data as Iterable<ITile3d>);
        } else {
            // single ITile3d
            this.cut = new Set<ITile3d>([data as ITile3d]);
        }
        this.parents = new Set();
        this.frontier = new Set();
        this.refinePQ = PriorityQueue.fromMax((t) => t.sse);
        this.coarsenPQ = PriorityQueue.fromMin((t) => t.sse);
    }
}

export interface ITile3dContentLoader extends ISourceBlock<ITile3d> {
    load(tile: ITile3d): void;
    cancel(tile: ITile3d): void;
    loadTileSetAsync(uri: string): Promise<Nullable<ITileset>>;
}

export interface ITile3dStreamEngine extends ISourceBlock<ITile3d>, IHasDisplay, ITargetBlock<ITile3d> {
    rootReadyObservable: Observable<ITileset>;
    options: ITile3dStreamEngineOptions;
    contentOptions: ITile3dStreamEngineContentOptions;
    activeView: Nullable<ActiveContext>;
    display: Nullable<IDisplay>;
    setContext(state?: ICameraViewState): void;
}

export class Tile3dStreamEngine extends SourceBlock<ITile3d> implements ITile3dStreamEngine {
    public static DEFAULT_MAX_SCREEN_SPACE_ERROR = 16;
    public static DEFAULT_HYSTERESIS_PERCENT = 0.1;
    private static readonly DEFAULT_NAV_OPTIONS: ITile3dStreamEngineOptions = {
        hysteresisPercent: Tile3dStreamEngine.DEFAULT_HYSTERESIS_PERCENT,
    };
    private static readonly DEFAULT_CONTENT_OPTIONS: ITile3dStreamEngineContentOptions = {
        maxScreenSpaceError: Tile3dStreamEngine.DEFAULT_MAX_SCREEN_SPACE_ERROR,
    };

    private readonly _uri: string;
    private readonly _baseUri: string;
    private readonly _options: ITile3dStreamEngineOptions;
    private readonly _contentOptions: ITile3dStreamEngineContentOptions;
    private readonly _tileContentLoader: ITile3dContentLoader;

    private _views: [Nullable<ActiveContext>, Nullable<ActiveContext>] = [null, null];

    private _root: Nullable<ITileset> = null;
    private _visited: Array<ITile3d> = [];

    // display
    private readonly _display: IDisplay;

    // Root loading coordination
    private _rootReadyObservable?: Observable<ITileset>;

    // Keep latest view-state to re-process after async loads
    private _pendingState: ICameraViewState | null = null;
    private _isProcessing = false;

    private _cartesianCache: Cartesian3[] = [Cartesian3.Zero()];

    public constructor(
        uri: string,
        display: IDisplay,
        contentLoader: ITile3dContentLoader,
        contentOptions?: ITile3dStreamEngineContentOptions,
        navOptions?: ITile3dStreamEngineOptions
    ) {
        super();
        this._uri = uri;
        this._baseUri = PathUtils.GetBaseUrl(uri);
        this._display = display;
        this._tileContentLoader = contentLoader;
        this._tileContentLoader.linkTo(this);
        this._options = navOptions ?? Tile3dStreamEngine.DEFAULT_NAV_OPTIONS;
        this._contentOptions = contentOptions ?? Tile3dStreamEngine.DEFAULT_CONTENT_OPTIONS;
    }

    public get rootReadyObservable(): Observable<ITileset> {
        if (!this._rootReadyObservable) {
            this._rootReadyObservable = new Observable<ITileset>();
        }
        return this._rootReadyObservable;
    }

    public get options(): ITile3dStreamEngineOptions {
        return this._options;
    }

    public get contentOptions(): ITile3dStreamEngineContentOptions {
        return this._contentOptions;
    }

    public get display(): Nullable<IDisplay> {
        return this._display;
    }

    public get activeView(): Nullable<ActiveContext> {
        return this._views[0];
    }

    public setContext(state?: ICameraViewState): void {
        this._pendingState = state ?? null;
        this._visited = [];
        void this._process();
    }

    protected async _process(): Promise<void> {
        if (this._isProcessing) return;
        this._isProcessing = true;
        try {
            // Ensure root tileset is loaded once
            if (!this._root) {
                await this._initializeRootAsync();
                // fallthrough: after load, we’ll consume latest pending state
            }

            const camState = this._pendingState;
            if (!camState) return; // nothing to do
            this._pendingState = null;

            // build the current view
            var lastView = this._views[0]; // the view from last frame
            let currentView: ActiveContext; // the one to build.

            if (!lastView || (lastView.cut.size ?? 0) == 0) {
                if (!this._root) {
                    return;
                }
                currentView = new ActiveContext(this._root?.root);
            } else {
                currentView = new ActiveContext(lastView.cut);
            }

            this._views[1] = lastView;
            this._views[0] = currentView;

            // main stream logic
            // -----------------
            // the tile to remove
            const toRemove: ITile3d[] = [];

            const fn = this._options.screenSpaceError ?? DefaultScreenSpaceError;
            let mse = this._contentOptions.maxScreenSpaceError ?? Tile3dStreamEngine.DEFAULT_MAX_SCREEN_SPACE_ERROR;
            const ellipsoid = this._contentOptions.ellipsoid ?? Ellipsoid.WGS84;
            const planetRadius = ellipsoid.semiMajorAxis;
            let refineBudget: number = this._options.maxRefinePerFrame ?? Number.MAX_VALUE;
            let coarsenBudget: number = this._options.maxCoarsenPerFrame ?? Number.MAX_VALUE;

            for (const leaf of currentView.cut) {
                this._visited.push(leaf);

                if (leaf.geometricError === undefined || !leaf.worldBoundingVolume?.sphere) {
                    // we can not process the tile due to a severe lack of informations
                    // Not supposed to happen because we iterate over already checked tiles.
                    continue;
                }

                const visibleNow = this._isVisible(leaf, camState, planetRadius);
                if (!visibleNow) {
                    if (leaf.visible) {
                        leaf.visible = visibleNow;
                        this._freeze(leaf);
                    }
                    continue;
                }
                // here it's visible.
                if (!leaf.visible) {
                    leaf.visible = visibleNow;
                    this._unfreeze(leaf);
                }

                const tileCenter = this._cartesianCache[0];
                tileCenter.resetFromArray(leaf.worldBoundingVolume.sphere);

                // we compute the distance from the camera, using the center of the bounding volume
                const distanceToCamera = Cartesian3.Distance(camState.worldPosition, tileCenter);
                leaf.sse = fn(leaf.geometricError, distanceToCamera, this._display.resolution.height, camState.tanFov2);
            }

            //Build refine/coarsen queues from *visible leaves only*
            for (const leaf of currentView.cut) {
                if (leaf.visible) {
                    mse = this._contentOptions.maxScreenSpaceErrorFn?.(leaf.depth) ?? Tile3dStreamEngine.DEFAULT_MAX_SCREEN_SPACE_ERROR;
                    if (leaf.hasExternal || leaf.sse > mse) {
                        currentView.refinePQ.enqueue(leaf);
                    }
                }
            }

            const toLoad = [];
            if (refineBudget != 0 && !currentView.refinePQ.isEmpty()) {
                do {
                    const leaf = currentView.refinePQ.dequeue();
                    refineBudget--;
                    if (!leaf) {
                        continue;
                    }
                    if (leaf.children) {
                        switch (leaf.refineType) {
                            case Tile3dRefineType.add: {
                                for (const child of leaf.children) {
                                    if (this._isVisible(child, camState, planetRadius)) {
                                        child.visible = true;
                                        if (child.contentStatus == TileContentStatus.idle) {
                                            toLoad.push(child);
                                        }
                                    }
                                }
                                break;
                            }
                            case Tile3dRefineType.replace:
                            default: {
                                if (!leaf.contents?.length || leaf.contentStatus == TileContentStatus.ready) {
                                    for (const child of leaf.children) {
                                        if (this._isVisible(child, camState, planetRadius)) {
                                            child.visible = true;
                                            if (child.contentStatus == TileContentStatus.idle) {
                                                toLoad.push(child);
                                            }
                                        }
                                    }
                                    toRemove.push(leaf);
                                    currentView.cut.delete(leaf);
                                }
                                break;
                            }
                        }
                    } else {
                        // thanks to the specification, it might be a tile with external reference set
                        //if (leaf.status == TileContentStatus.idle) {
                        //    leaf.status = TileContentStatus.pending;
                        //    this._loadExternalSet(leaf);
                        //}
                    }
                } while (refineBudget != 0 && !currentView.refinePQ.isEmpty());
            }

            if (coarsenBudget != 0 && !currentView.coarsenPQ.isEmpty()) {
                do {
                    coarsenBudget--;
                } while (coarsenBudget != 0 && !currentView.coarsenPQ.isEmpty());
            }

            if (toRemove.length) {
                for (const item of toRemove) {
                    switch (item.contentStatus) {
                        case TileContentStatus.pending: {
                            this._tileContentLoader.cancel(item);
                            break;
                        }
                        case TileContentStatus.ready: {
                            break;
                        }
                    }
                    if (item.visible) {
                        currentView.cut.delete(item);
                    }
                }
                this.notifyRemoved(toRemove, -1, this, this);
            }

            // the remain tiles
            //const remains: ITile3d[] = Array.from(currentView.cut);

            if (toLoad.length) {
                for (const leaf of toLoad) {
                    if (leaf.visible) {
                        this._tileContentLoader.load(leaf);
                    }
                }
            }
        } finally {
            this._isProcessing = false;

            // If state changed during async work, process again
            if (this._pendingState) {
                const again = this._pendingState;
                this._pendingState = null; // avoid infinite loop; _process will set if new input arrives
                if (again) this.setContext(again);
            }
        }
    }

    protected _isVisible(leaf: ITile3d, camState: ICameraViewState, radius: number): boolean {
        if (!leaf.worldBoundingVolume?.sphere) {
            return true;
        }
        if (IsTileSphereBeyondHorizon(leaf.worldBoundingVolume.sphere, camState.worldPosition, radius)) {
            return false;
        }
        return IsSphereInFrustum(leaf.worldBoundingVolume.sphere, camState.frustumPlanes);
    }

    protected _freeze(leaf: ITile3d): void {}
    protected _unfreeze(leaf: ITile3d): void {}

    protected _internalResolveUri(uri: string): string {
        return this._contentOptions.uriResolver?.resolve(uri) ?? uri;
    }

    protected async _initializeRootAsync(): Promise<void> {
        const ts = await this._tileContentLoader.loadTileSetAsync(this._uri);
        if (ts) {
            this._root = ts;
            if (ts.root) {
                this._initializeSet(ts); // this is where we link the nodes and set the worldTransform
                this._views[0] = new ActiveContext(ts.root);
            }
            this._rootReadyObservable?.notifyObservers(ts, -1, this, this);
        }
    }

    protected _initializeSet(tileset: ITileset, from?: ITile3d): void {
        if (tileset.root) {
            this._initializeTile(tileset.root, from);
        }
    }

    protected _initializeTile(tile: ITile3d, parent?: ITile3d): void {
        tile.parent = parent;
        tile.contentStatus = TileContentStatus.idle;
        // every tile start with a average priority of 50. Priority is set from 0 to 100 with zero is the lowest priority.
        // priority will be used by loader which load the tile using a maximum batch size
        tile.priority = Tile3dNormalPriority;

        if (parent?.worldTransform || tile.transform) {
            const parentTransform = parent?.worldTransform ?? IDENTITY44;
            const localTransform = tile.transform ?? IDENTITY44;
            tile.worldTransform = new Float64Array(16);
            Mat44MultToRef(parentTransform, localTransform, tile.worldTransform);
        }

        tile.depth = parent !== undefined ? parent.depth + 1 : 0;

        const refine = tile.refine ?? "REPLACE";
        switch (refine) {
            case "ADD": {
                tile.refineType = Tile3dRefineType.add;
                break;
            }
            case "REPLACE":
            default: {
                tile.refineType = Tile3dRefineType.replace;
                break;
            }
        }

        if (tile.boundingVolume) {
            if (!tile.boundingVolume.box) {
                if (tile.boundingVolume.region) {
                }
            }
            if (tile.boundingVolume.box) {
                if (!tile.boundingVolume.sphere) {
                    tile.boundingVolume.sphere = CreateTileSphereFromBox(tile.boundingVolume.box);
                }
            }
            tile.worldBoundingVolume = {
                sphere: tile.boundingVolume.sphere?.slice(0, 4) as unknown as SphereType,
                box: tile.boundingVolume.box?.slice(0, 12) as unknown as BoxType,
            };
            EcefBoxToBjsInPlace(tile.worldBoundingVolume.box!);
            EcefSphereToBjsInPlace(tile.worldBoundingVolume.sphere!);
        }
        // compute and set absolute paths for every content uri.
        if (tile.content) {
            // transfert everything to contents..
            tile.contents = tile.contents ?? [];
            tile.contents.push(tile.content);
            tile.content = undefined;
        }

        if (tile.contents) {
            tile.hasExternal = false;
            for (const c of tile.contents) {
                let uri = PathUtils.IsRelativeUrl(c.uri) ? PathUtils.ResolveUri(this._baseUri, c.uri) : c.uri;
                c.uri = uri;
                if (c.uri && PathUtils.EndsWith(c.uri, ".json")) {
                    tile.hasExternal = true;
                }
            }
        }
        if (tile.children) {
            for (const t of tile.children) {
                this._initializeTile(t, tile);
            }
        }
    }
    public updated(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        const ctx = this.activeView;
        if (ctx) {
            for (const t of eventData) {
                const contents = GetTile3dContents(t);
                if (contents) {
                    let hasExternalOnly = true;
                    for (const c of contents) {
                        if (c.container) {
                            if (IsITileset(c.container)) {
                                this._initializeSet(c.container, t);
                                if (!t.children) {
                                    t.children = [c.container.root];
                                } else {
                                    // may happen if several external set linked to one tile.
                                    t.children.push(c.container.root);
                                }

                                continue;
                            }
                            hasExternalOnly = false;
                        }
                    }
                    if (!hasExternalOnly) {
                        this.notifyUpdated([t], -1, this, this);
                    }
                }
                ctx.cut.add(t);
            }
        }
    }
}
