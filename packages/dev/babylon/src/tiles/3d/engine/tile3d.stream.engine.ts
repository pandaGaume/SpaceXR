import { Nullable } from "core/types";
import { ICameraViewState, IDisplay, IHasDisplay, ISourceBlock, SourceBlock } from "core/tiles";
import { Cartesian3, IPlane } from "core/geometry";
import { Fifo, PriorityQueue } from "core/collections";
import { FetchResult, WebClient } from "core/io";
import { PathUtils } from "core/utils";

import { BoxType, CreateTileSphereFromBox, GetTile3dContents, IBoundingVolume, ITile3d, ITileset, SphereType } from "../interfaces";
import {
    EcefBoxToBjsInPlace,
    EcefSphereToBjsInPlace,
    IDENTITY44,
    IsPointInBox,
    IsPointInSphere,
    IsSphereInFrustum,
    IsTileSphereBeyondHorizon,
    Mat44MultToRef,
    Mat44Type,
} from "../interfaces/math/math";
import { TilesetClient } from "./tile3d.stream.client";
import { Observable } from "core/events";
import { Ellipsoid } from "core/geodesy";

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

/**
 * used to test if the object is within camera view boundaries.
 */
interface ICullable {
    isInFrustum(frustumPlanes: IPlane[]): boolean;
}

export interface IStreamableNode {}

export enum TileStatus {
    idle,
    selected,
    loading,
    ready,
    error,
    unkknown = 999,
}

/** Augmentation for the engine */
declare module "../interfaces/tile3d" {
    interface ITile3d extends IStreamableNode, ICullable {
        status: TileStatus;
        parent?: ITile3d;
        worldTransform?: Mat44Type; // ECEF world transform
        refineType: Tile3dRefineType; // refine type enum value
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

export class ActiveView {
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

export interface ITile3dStreamEngine extends ISourceBlock<ITile3d>, IHasDisplay {
    rootReadyObservable: Observable<ITileset>;
    options: ITile3dStreamEngineOptions;
    contentOptions: ITile3dStreamEngineContentOptions;
    root: Nullable<ITileset>;
    activeView: Nullable<ActiveView>;
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
    private readonly _tilesetClient: WebClient<string, ITileset>;

    private _views: [Nullable<ActiveView>, Nullable<ActiveView>] = [null, null];

    private _root: Nullable<ITileset> = null;
    private _visited: Array<ITile3d> = [];

    private readonly _tileSets = new Map<string, Nullable<ITileset>>();
    private readonly _loadings = new Map<string, Promise<FetchResult<string, Nullable<ITileset>>>>();

    // display
    private readonly _display: IDisplay;

    // Root loading coordination
    private _rootReadyObservable?: Observable<ITileset>;

    // Keep latest view-state to re-process after async loads
    private _pendingState: ICameraViewState | null = null;
    private _isProcessing = false;

    private _cartesianCache: Cartesian3[] = [Cartesian3.Zero()];

    public constructor(uri: string, display: IDisplay, contentOptions?: ITile3dStreamEngineContentOptions, navOptions?: ITile3dStreamEngineOptions) {
        super();
        this._uri = uri;
        this._baseUri = PathUtils.GetBaseUrl(uri);
        this._display = display;
        this._tilesetClient = navOptions?.client ?? new TilesetClient(uri);
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

    public get activeView(): Nullable<ActiveView> {
        return this._views[0];
    }

    public get root(): Nullable<ITileset> {
        return this._root;
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
                const ts = await this._loadSetAsync(this._uri);
                if (ts) {
                    this._root = ts;
                    if (ts.root) {
                        this._initializeSet(ts); // this is where we link the nodes and set the worldTransform
                        this._activeTiles.add(ts.root);
                    }
                    this._rootReadyObservable?.notifyObservers(ts, -1, this, this);
                }
                // fallthrough: after load, we’ll consume latest pending state
            }

            const camState = this._pendingState;
            if (!camState) return; // nothing to do
            this._pendingState = null;

            // build the current view
            var lastView = this._views[0]; // the view from last frame
            let currentView: ActiveView; // the one to build.

            if (!lastView || (lastView.cut.size ?? 0) == 0) {
                if (!this._root?.root) {
                    return;
                }
                currentView = new ActiveView(this._root?.root);
            } else {
                currentView = new ActiveView(lastView.cut);
            }

            this._views[1] = lastView;
            this._views[0] = currentView;

            // main stream logic
            // -----------------
            // the tile to add
            const toAdd: ITile3d[] = [];
            // the tile to remove
            const unvisibles: ITile3d[] = [];
            const toReplace: ITile3d[] = [];

            const fn = this._options.screenSpaceError ?? DefaultScreenSpaceError;
            let mse = this._contentOptions.maxScreenSpaceError ?? Tile3dStreamEngine.DEFAULT_MAX_SCREEN_SPACE_ERROR;
            const ellipsoid = this._contentOptions.ellipsoid ?? Ellipsoid.WGS84;
            const planetRadius = ellipsoid.semiMajorAxis;
            const refineBudget: number = this._options.maxRefinePerFrame ?? Number.MAX_VALUE;
            const coarsenBudget: number = this._options.maxCoarsenPerFrame ?? Number.MAX_VALUE;

            for (const leaf of currentView.cut) {
                this._visited.push(leaf);

                if (!leaf.geometricError === undefined || !leaf.worldBoundingVolume || !leaf.worldBoundingVolume.sphere) {
                    // we can not process the tile due to a severe lack of informations
                    // Not supposed to happen because we iterate over already checked tiles.
                    continue;
                }

                if (!this._isVisible(leaf, camState, planetRadius)) {
                    unvisibles.push(leaf);
                    continue;
                }

                const tileCenter = this._cartesianCache[0];
                tileCenter.resetFromArray(leaf.worldBoundingVolume.sphere);

                // we compute the distance from the camera, using the center of the bounding volume
                const distanceToCamera = Cartesian3.Distance(camState.worldPosition, tileCenter);
                leaf.sse = fn(leaf.geometricError, distanceToCamera, this._display.resolution.height, camState.tanFov2);
            }

            // remove every unvisible tiles from the active view
            if (unvisibles.length) {
                for (const item of unvisibles) {
                    currentView.cut.delete(item);
                }
            }

            //Build refine/coarsen queues from *visible leaves only*
            for (const leaf of currentView.cut) {
                mse = this._contentOptions.maxScreenSpaceErrorFn?.(leaf.depth) ?? Tile3dStreamEngine.DEFAULT_MAX_SCREEN_SPACE_ERROR;
                if (leaf.sse > mse) {
                    currentView.refinePQ.push(leaf);
                }
            }

            while (refineBudget == 0 || currentView.refinePQ.isEmpty) {
                const leaf = currentView.refinePQ.pop();
                if (!leaf) {
                    continue;
                }
                switch (leaf.refineType) {
                    case Tile3dRefineType.add: {
                        break;
                    }
                    case Tile3dRefineType.replace:
                    default: {
                        toReplace.push(leaf);
                        break;
                    }
                }
                if (leaf.children) {
                    for (const child of leaf.children) {
                        if (this._isVisible(child, camState, planetRadius)) {
                            toAdd.push(child);
                        }
                    }
                }
            }
            if (toReplace.length) {
                for (const item of toReplace) {
                    currentView.cut.delete(item);
                }
            }

            while (coarsenBudget == 0 || currentView.coarsenPQ.isEmpty) {}

            /*                   // check the content for external ref
                    const content = GetTile3dContents(tile);
                    if (content) {
                        let hasExternalOnly = true;
                        for (const c of content) {
                            if (c?.uri && PathUtils.EndsWith(c.uri, ".json")) {
                                const loaded = await this._loadSetAsync(c.uri);
                                if (loaded) {
                                    this._initializeSet(loaded, tile);
                                    if (loaded.root) {
                                        toProcess.enqueue(loaded.root);
                                    }
                                }
                            }
                            hasExternalOnly = false;
                        }
                        if (hasExternalOnly) {
                            continue;
                        }
                    }
                }
            } while (!toProcess.isEmpty());

            if (toRemove.length) {
                for (const item of toRemove) {
                    this._activeTiles.delete(item);
                }
                this.notifyRemoved(toRemove, -1, this, this);
            }

            // the remain tiles
            // const remains: ITile3d[] = Array.from(this._activeTiles);

            if (toAdd.length) {
                //this._activeTiles.add(toAdd[0]);
                //this.notifyAdded([toAdd[0]], -1, this, this);
                for (const item of toAdd) {
                    this._activeTiles.add(item);
                }
                this.notifyAdded(toAdd, -1, this, this);
            } */
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

    protected _internalResolveUri(uri: string): string {
        return this._contentOptions.uriResolver?.resolve(uri) ?? uri;
    }

    protected async _loadSetAsync(uri: string, signal?: AbortSignal): Promise<Nullable<ITileset>> {
        // Return from cache if present
        const cached = this._tileSets.get(uri);
        if (cached) {
            return cached;
        }
        // In-flight de-dupe
        let loadPromise = this._loadings.get(uri);
        if (!loadPromise) {
            // Single producer of the promise
            // we resolve here to keep the credential out of cache.
            const resolvedUri = this._internalResolveUri(uri);
            const p = this._tilesetClient.fetchAsync(resolvedUri, { signal });
            this._loadings.set(uri, p);
            loadPromise = p;
        }
        try {
            const result = await loadPromise;
            // 4) Normalize outcomes
            if (!result?.ok) {
                // Policy: null for 404/no content, throw otherwise
                if (result?.status === 404 || result?.status === 410 || result?.content == null) {
                    return null;
                }
                throw new Error(`Tileset fetch failed (${result?.status ?? "unknown"}) for ${uri}`);
            }
            // Guard against empty success
            if (!result.content) {
                return null;
            }

            this._tileSets.set(uri, result.content);
            return result.content;
        } catch (err) {
            // If aborted, swallow..
            if ((err as DOMException)?.name === "AbortError") {
                return null;
            }
            throw err;
        } finally {
            // Race-proof cleanup
            const current = this._loadings.get(uri);
            if (current === loadPromise) {
                this._loadings.delete(uri);
            }
        }
    }

    protected _initializeSet(tileset: ITileset, from?: ITile3d): void {
        if (tileset.root) {
            this._initializeTile(tileset.root, from);
        }
    }

    protected _initializeTile(tile: ITile3d, parent?: ITile3d): void {
        tile.parent = parent;

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
}
