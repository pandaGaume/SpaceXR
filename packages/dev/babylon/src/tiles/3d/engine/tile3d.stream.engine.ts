import { Nullable } from "core/types";
import { ICameraViewState, IDisplay, IHasDisplay, ISourceBlock, SourceBlock } from "core/tiles";
import { Cartesian3, IPlane } from "core/geometry";
import { Fifo } from "core/collections";
import { WebClient } from "core/io";
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

/** Augmentation for the engine */
declare module "../interfaces/tile3d" {
    interface ITile3d extends IStreamableNode, ICullable {
        ownerSet?: [string, ITileset];
        externalSets?: Array<[string, ITileset]>;
        parent?: ITile3d | ITileset;
        worldTransform?: Mat44Type;
        refineType: Tile3dRefineType;
        depth: number;
        worldBoundingVolume?: IBoundingVolume;
    }
}

/** Augmentation for the engine */
declare module "../interfaces/tileset" {
    interface ITileset extends IStreamableNode {
        parent?: ITile3d;
    }
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
}

export interface ITile3dStreamEngine extends ISourceBlock<ITile3d>, IHasDisplay {
    rootReadyObservable: Observable<ITileset>;
    options: ITile3dStreamEngineOptions;
    contentOptions: ITile3dStreamEngineContentOptions;
    root: Nullable<ITileset>;
    activeTiles: ITile3d[];
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
    private readonly _options: ITile3dStreamEngineOptions;
    private readonly _contentOptions: ITile3dStreamEngineContentOptions;
    private readonly _tilesetClient: WebClient<string, ITileset>;

    private _activeTiles = new Set<ITile3d>();
    private _root: Nullable<ITileset> = null;
    private readonly _tileSets = new Map<string, ITileset>();
    private readonly _loadings = new Set<string>();

    // display
    private readonly _display: IDisplay;

    // Root loading coordination
    private _rootPromise: Promise<[string, Nullable<ITileset>]> | null = null;
    private _rootReadyObservable?: Observable<ITileset>;

    // Keep latest view-state to re-process after async loads
    private _pendingState: ICameraViewState | null = null;
    private _isProcessing = false;

    private _cartesianCache: Cartesian3[] = [Cartesian3.Zero()];

    public constructor(uri: string, display: IDisplay, contentOptions?: ITile3dStreamEngineContentOptions, navOptions?: ITile3dStreamEngineOptions) {
        super();
        this._uri = uri;
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

    public get activeTiles(): ITile3d[] {
        return Array.from(this._activeTiles);
    }

    public get root(): Nullable<ITileset> {
        return this._root;
    }

    public setContext(state?: ICameraViewState): void {
        this._pendingState = state ?? null;
        void this._process();
    }

    protected async _process(): Promise<void> {
        if (this._isProcessing) return;
        this._isProcessing = true;
        try {
            // Ensure root tileset is loaded once
            if (!this._root) {
                if (!this._rootPromise) {
                    let uri = this._resolveUri(this._uri);
                    this._rootPromise = this._loadSetAsync(uri);
                }
                const result = await this._rootPromise;
                if (result) {
                    const ts = result[1];
                    if (ts) {
                        this._root = ts;
                        this._initializeSet(this._uri, ts); // this is where we link the nodes and set the worldTransform
                        if (ts.root) {
                            this._activeTiles.add(ts?.root);
                        }
                        this._rootReadyObservable?.notifyObservers(ts, -1, this, this);
                    }
                }
                // fallthrough: after load, we’ll consume latest pending state
            }

            const state = this._pendingState;
            if (!state) return; // nothing to do
            this._pendingState = null;

            if (this._activeTiles.size == 0) {
                if (!this._root?.root) {
                    return;
                }
                this._activeTiles.add(this._root?.root);
            }

            // main stream logic
            // -----------------
            // the tile to add
            const toAdd: ITile3d[] = [];
            // the tile to remove
            const toRemove: ITile3d[] = [];
            // Used to cache the computed offset value. The offset stabilizes the refinement process
            // by introducing a threshold before coarsening back.
            //let offset: number | undefined = undefined;

            // we loop over every activ tiles, while not empty. at this point we know that there is at least one activ tile.
            const toProcess = new Fifo<ITile3d>(...this.activeTiles);
            const fn = this._options.screenSpaceError ?? DefaultScreenSpaceError;
            let mse = this._contentOptions.maxScreenSpaceError ?? Tile3dStreamEngine.DEFAULT_MAX_SCREEN_SPACE_ERROR;
            const ellipsoid = this._contentOptions.ellipsoid ?? Ellipsoid.WGS84;
            const planetRadius = ellipsoid.semiMajorAxis;
            do {
                const tile = toProcess.dequeue();
                if (!tile || tile.geometricError === undefined || tile.boundingVolume === undefined) {
                    continue;
                }

                if (!tile.worldBoundingVolume || !tile.worldBoundingVolume.sphere) {
                    continue;
                }

                const tileCenter = this._cartesianCache[0];
                tileCenter.resetFromArray(tile.worldBoundingVolume.sphere);

                if (IsTileSphereBeyondHorizon(tile.worldBoundingVolume.sphere, state.worldPosition, planetRadius)) {
                    if (this._activeTiles.has(tile)) {
                        toRemove.push(tile);
                    }
                    continue;
                }

                // is the camera inside request volume ?
                if (tile.viewerRequestVolume) {
                    if (tile.viewerRequestVolume.sphere) {
                        if (!IsPointInSphere(tile.viewerRequestVolume.sphere, state.worldPosition)) {
                            if (this._activeTiles.has(tile)) {
                                toRemove.push(tile);
                            }
                            continue;
                        }
                    }

                    if (tile.viewerRequestVolume.box) {
                        if (!IsPointInBox(tile.viewerRequestVolume.box, state.worldPosition)) {
                            if (this._activeTiles.has(tile)) {
                                toRemove.push(tile);
                            }
                            continue;
                        }
                    }
                }

                // is the tile viewed by the camera ?
                if (state.frustumPlanes) {
                    if (!IsSphereInFrustum(tile.worldBoundingVolume.sphere, state.frustumPlanes)) {
                        if (this._activeTiles.has(tile)) {
                            toRemove.push(tile);
                        }
                        continue;
                    }
                }

                // we compute the distance from the camera, using the center of the bounding volume
                const distanceToCamera = Cartesian3.Distance(state.worldPosition, tileCenter);
                const sse = fn(tile.geometricError, distanceToCamera, this._display.resolution.height, state.tanFov2);
                if (this._contentOptions.maxScreenSpaceErrorFn) {
                    mse = this._contentOptions.maxScreenSpaceErrorFn(tile.depth) ?? Tile3dStreamEngine.DEFAULT_MAX_SCREEN_SPACE_ERROR;
                }
                if (sse > mse) {
                    // refine.
                    const refine = tile.refineType;
                    if (refine == Tile3dRefineType.replace) {
                        // deactivate tile
                        if (this._activeTiles.has(tile)) {
                            toRemove.push(tile);
                        }
                    }
                    if (tile.children?.length) {
                        for (const subtile of tile.children) {
                            toProcess.enqueue(subtile);
                        }
                    }
                    continue;
                }

                /*
                offset =
                    offset ??
                    this._navOptions.hysteresisOffset ??
                    this._navOptions.maxScreenSpaceError * (this._navOptions.hysteresisPercent ?? Tile3dStreamEngine.DEFAULT_HYSTERESIS_PERCENT);

                if (sse < this._navOptions.maxScreenSpaceError - offset) {
                    // coarse
                    const p = tile.parent;
                    if (p && IsTile3d(p)) {
                        if (!toProcess.includes(p)) {
                            // enqueue only if not already in
                            toProcess.enqueue(p);
                        }
                    }
                    if (this._activeTiles.has(tile)) {
                        toRemove.push(tile);
                    }
                    continue;
                }*/

                // keep the tile activ or add it
                if (!this._activeTiles.has(tile)) {
                    // check the content for external ref
                    const content = GetTile3dContents(tile);
                    if (content) {
                        const jsonRefs: string[] = [];
                        for (const c of content) {
                            if (c?.uri && PathUtils.EndsWith(c.uri, ".json")) {
                                // here we are sure it's absolute because it has been initialized after the loading
                                jsonRefs.push(c.uri);
                            }
                        }
                        if (jsonRefs.length) {
                            // we might think of doing this async...
                            const loaded = await Promise.all(jsonRefs.map((absolutePath) => this._loadSetAsync(absolutePath)));
                            // Filter out null values and tell TypeScript that the result contains only ITileset.
                            const result = loaded.filter((entry): entry is [string, ITileset] => !!entry[1]);
                            if (result && result.length) {
                                tile.externalSets = result;
                                for (var ts of result) {
                                    const path = ts[0];
                                    const item = ts[1];
                                    this._initializeSet(path, item, tile); // itialize the set using the current tile as reference.
                                    if (item.root) {
                                        toProcess.enqueue(item.root);
                                    }
                                }
                            }
                            if (jsonRefs.length == content.length) {
                                continue;
                            }
                        }
                        toAdd.push(tile);
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

    protected _resolveUri(uri: string): string {
        return this._contentOptions.uriResolver?.resolve(uri) ?? uri;
    }

    protected async _loadSetAsync(uri: string): Promise<[string, Nullable<ITileset>]> {
        if (this._tileSets.has(uri)) {
            return [uri, this._tileSets.get(uri) ?? null];
        }
        if (this._loadings.has(uri)) return [uri, null];
        this._loadings.add(uri);
        try {
            const resolvedUri = this._contentOptions.uriResolver?.resolve(uri) ?? uri;
            const result = await this._tilesetClient.fetchAsync(resolvedUri);
            if (result.ok && result.content) {
                this._tileSets.set(uri, result.content);
            } else {
                return [uri, null];
            }
            return [uri, result.content];
        } catch (err) {
            // If aborted, swallow..
            if ((err as DOMException)?.name === "AbortError") return [uri, null];
            throw err;
        } finally {
            this._loadings.delete(uri);
        }
    }

    protected _initializeSet(baseUrl: string, tileset: ITileset, from?: ITile3d): [string, ITileset] {
        // init the parents, owner
        tileset.parent = from;
        if (tileset.root) {
            this._initializeTile(baseUrl, tileset.root, from);
        }
        return [baseUrl, tileset];
    }

    protected _initializeTile(baseUrl: string, tile: ITile3d, parent?: ITile3d) {
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
        }

        if (tile.contents) {
            for (const c of tile.contents) {
                let uri = PathUtils.IsRelativeUrl(c.uri) ? PathUtils.ResolveUri(baseUrl, c.uri) : c.uri;
                c.uri = uri;
            }
        }
        if (tile.children) {
            for (const t of tile.children) {
                this._initializeTile(baseUrl, t, tile);
            }
        }
    }
}
