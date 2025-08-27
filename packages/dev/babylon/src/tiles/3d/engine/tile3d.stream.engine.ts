import { Nullable } from "core/types";
import { ICameraViewState, IDisplay, IHasDisplay, ISourceBlock, SourceBlock } from "core/tiles";
import { IPlane } from "core/geometry";
import { Fifo } from "core/collections";
import { WebClient } from "core/io";
import { PathUtils } from "core/utils";

import { IsTile3d, ITile3d, ITileset } from "../interfaces";
import { Distance, IDENTITY44, IsBoxInFrustum, IsPointInBox, IsPointInSphere, IsSphereInFrustum, Mat44Type, MulMat44, TransformPointToRef } from "../interfaces/math/math";
import { TilesetClient } from "./tile3d.stream.client";

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
 * used to test if the object is within camera view boundaries.
 */
interface ICullable {
    isInFrustum(frustumPlanes: IPlane[]): boolean;
}

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
export const ScreenSpaceError: ScreenSpaceErrorFn = (tileGeometricError, distanceToCamera, viewportHeight, tanfov2) =>
    (tileGeometricError * viewportHeight) / (distanceToCamera * tanfov2);

export interface IStreamableNode {}

/** Augmentation for the engine */
declare module "../interfaces/tile3d" {
    interface ITile3d extends IStreamableNode, ICullable {
        ownerSet?: [string, ITileset];
        externalSets?: Array<[string, ITileset]>;
        parent?: ITile3d | ITileset;
        worldTransform?: Mat44Type;
        refineType: Tile3dRefineType;
    }
}

/** Augmentation for the engine */
declare module "../interfaces/tileset" {
    interface ITileset extends IStreamableNode {
        parent?: ITile3d;
    }
}

export interface ITile3dStreamEngineNavOptions {
    /**
     * If true, the engine tests each tile’s bounding volume
     * against the active camera frustum for visibility culling.
     */
    testFrustum?: boolean;

    /**
     * If true, the engine tests the camera (viewer) position
     * against the tile’s optional viewer request volume.
     * This determines whether the tile should be considered for loading/rendering.
     */
    testViewerVolume?: boolean;

    /**
     * The maximum allowed screen-space error (SSE), in pixels,
     * before a object should be refined (loaded at higher LOD).
     * Typical values: 8–24 depending on visual quality requirements.
     */
    maxScreenSpaceError: number;

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
     * Optional function to compute the screen space error (SSE) for this object.
     */
    screenSpaceError?: ScreenSpaceErrorFn;
}

export interface ITile3dStreamEngineContentOptions {}

export interface ITile3dStreamEngine extends ISourceBlock<ITile3d>, IHasDisplay {
    setContext(state: ICameraViewState): void;
}

/**
 * Coordinate reference system for Tile3D.
 *
 * - Default: ECEF (Earth-Centered, Earth-Fixed) Cartesian coordinates
 *   with the WGS84 ellipsoid as the geodetic reference.
 *
 * - Local frames: Tilesets may specify a `transform` matrix at the root
 *   or per-tile level, allowing conversion to local systems such as ENU
 *   (East-North-Up), NED (North-East-Down), or projected systems (e.g., UTM).
 *
 * - Note: Datasets like CityGML or CAD may originate in local coordinates;
 *   the tileset JSON typically provides a root `transform` to align them
 *   with the global ECEF/WGS84 frame.
 */
export class Tile3dStreamEngine<T, M> extends SourceBlock<ITile3d> implements ITile3dStreamEngine {
    public static DEFAULT_MAX_SCREEN_SPACE_ERROR = 16;
    public static DEFAULT_HYSTERESIS_PERCENT = 0.1;
    private static readonly DEFAULT_NAV_OPTIONS: ITile3dStreamEngineNavOptions = {
        maxScreenSpaceError: Tile3dStreamEngine.DEFAULT_MAX_SCREEN_SPACE_ERROR,
        hysteresisPercent: Tile3dStreamEngine.DEFAULT_HYSTERESIS_PERCENT,
    };

    private readonly _uri: string;
    private readonly _navOptions: ITile3dStreamEngineNavOptions;
    private readonly _tilesetClient: WebClient<string, ITileset>;

    private _activeTiles = new Set<ITile3d>();
    private readonly _tileSets = new Map<string, ITileset>();
    private readonly _loadings = new Set<string>();

    // display
    private readonly _display: IDisplay;

    // Root loading coordination
    private _rootPromise: Promise<[string, Nullable<ITileset>]> | null = null;

    // Keep latest view-state to re-process after async loads
    private _pendingState: ICameraViewState | null = null;
    private _isProcessing = false;

    private _cartesianCache: number[] = [0, 0, 0, 0, 0, 0];

    public constructor(uri: string, display: IDisplay, client?: WebClient<string, ITileset>, navOptions?: ITile3dStreamEngineNavOptions) {
        super();
        this._uri = uri;
        this._display = display;
        this._tilesetClient = client ?? new TilesetClient(uri);
        this._navOptions = navOptions ?? Tile3dStreamEngine.DEFAULT_NAV_OPTIONS;
    }

    public get display(): Nullable<IDisplay> {
        return this._display;
    }

    public get activeTiles(): readonly ITile3d[] {
        return Array.from(this._activeTiles);
    }

    public get root(): ITileset | null {
        const ts = this._tileSets.get(this._uri);
        return ts ?? null;
    }

    public setContext(state: ICameraViewState): void {
        this._pendingState = state;
        void this._process();
    }

    protected async _process(): Promise<void> {
        if (this._isProcessing) return;
        this._isProcessing = true;
        try {
            // Ensure root tileset is loaded once
            if (!this.root) {
                if (!this._rootPromise) {
                    this._rootPromise = this._loadSetAsync(this._uri);
                }
                const result = await this._rootPromise;
                if (result) {
                    const ts = result[1];
                    if (ts) {
                        this._initializeSet(this._uri, ts); // this is where we link the nodes and set the worldTransform
                        if (ts.root) {
                            this._activeTiles.add(ts?.root);
                        }
                    }
                }
                // fallthrough: after load, we’ll consume latest pending state
            }

            const state = this._pendingState;
            if (!state) return; // nothing to do

            if (this._activeTiles.size == 0) {
                return; // nothing to do
            }

            // main stream logic
            // -----------------
            // the tile to add
            const toAdd: ITile3d[] = [];
            // the tile to remove
            const toRemove: ITile3d[] = [];
            // Used to cache the computed offset value. The offset stabilizes the refinement process
            // by introducing a threshold before coarsening back.
            let offset: number | undefined = undefined;

            // we loop over every activ tiles, while not empty. at this point we know that there is at least one activ tile.
            const toProcess = new Fifo<ITile3d>(...this.activeTiles);
            do {
                const tile = toProcess.dequeue();
                if (!tile || tile.geometricError === undefined || tile.boundingVolume === undefined) {
                    continue;
                }

                // is the camera inside request volume ?
                if (tile.viewerRequestVolume && this._navOptions.testViewerVolume) {
                    if (tile.viewerRequestVolume.sphere) {
                        if (!IsPointInSphere(tile.viewerRequestVolume.sphere, state.worldPosition)) {
                            continue;
                        }
                    } else if (tile.viewerRequestVolume.box) {
                        if (!IsPointInBox(tile.viewerRequestVolume.box, state.worldPosition)) {
                            continue;
                        }
                    }
                }

                // is the tile viewed by the camera ??
                if (this._navOptions.testFrustum && state.frustumPlanes) {
                    if (tile.boundingVolume.sphere) {
                        if (!IsSphereInFrustum(tile.boundingVolume.sphere, state.frustumPlanes)) {
                            continue;
                        }
                    } else if (tile.boundingVolume.box) {
                        if (!IsBoxInFrustum(tile.boundingVolume.box, state.frustumPlanes)) {
                            continue;
                        }
                    }
                }

                // we compute the distance from the camera, using the center of the bounding volume
                // which may be a box, a sphere or a region. For region we must know the reference system such ECEF or ENU
                // This information is provided as an options.
                // Default reference frame is ECEF (Earth-Centered, Earth-Fixed) with the WGS84 ellipsoid.
                const center = this._cartesianCache;
                if (!this._tryGetWorldCenterToRef(tile, center, 0)) {
                    continue;
                }
                const distanceToCamera = Distance(state.worldPosition, center, 0);

                const fn = this._navOptions.screenSpaceError ?? ScreenSpaceError;
                const sse = fn(tile.geometricError, distanceToCamera, this._display.resolution.height, state.tanFov2);
                if (sse > this._navOptions.maxScreenSpaceError) {
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
                }

                // keep the tile activ or add it
                if (!this._activeTiles.has(tile)) {
                    // check the content for external ref
                    const content = tile.contents ?? [tile.content];
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
                    }
                    toAdd.push(tile);
                }
            } while (!toProcess.isEmpty);

            if (toRemove.length) {
                for (const item of toRemove) {
                    this._activeTiles.delete(item);
                }
                this.notifyRemoved(toRemove, -1, this, this);
            }

            // the remain tiles
            // const remains: ITile3d[] = Array.from(this._activeTiles);

            if (toAdd.length) {
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

    protected _tryGetWorldCenterToRef(tile: ITile3d, ref: number[], offset: number = 0): boolean {
        const bv = tile.boundingVolume;
        if (!bv) {
            return false;
        }
        let src: number[] = (bv.box ? bv.box : bv.sphere) as number[];
        if (src) {
            if (tile.worldTransform) {
                TransformPointToRef(tile.worldTransform, src, 0, ref, offset);
            } else {
                ref[offset++] = src[0];
                ref[offset++] = src[1];
                ref[offset] = src[2];
            }
            return true;
        }
        return false;
    }

    protected async _loadSetAsync(uri: string): Promise<[string, Nullable<ITileset>]> {
        if (this._tileSets.has(uri)) {
            return [uri, this._tileSets.get(uri) ?? null];
        }
        if (this._loadings.has(uri)) return [uri, null];
        this._loadings.add(uri);
        try {
            const result = await this._tilesetClient.fetchAsync(uri);
            if (result.ok && result.content) {
                this._tileSets.set(uri, result.content);
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

    protected _initializeSet(path: string, tileset: ITileset, from?: ITile3d): [string, ITileset] {
        // init the parents, owner
        tileset.parent = from;
        const owner: [string, ITileset] = [path, tileset];
        const queue = new Fifo<ITile3d>();
        if (tileset.root) {
            const root = tileset.root;

            root.parent = tileset;
            let parentTransform = from?.worldTransform ?? IDENTITY44;
            let localTransform = root.transform ?? IDENTITY44;
            root.worldTransform = MulMat44(parentTransform, localTransform);
            queue.enqueue(root);

            const baseUrl = PathUtils.GetBaseUrl(path);
            do {
                const t = queue.dequeue();
                if (t) {
                    t.ownerSet = owner;
                    const refine = t.refine ?? "REPLACE";
                    switch (refine) {
                        case "ADD": {
                            t.refineType = Tile3dRefineType.add;
                            break;
                        }
                        case "REPLACE":
                        default: {
                            t.refineType = Tile3dRefineType.replace;
                            break;
                        }
                    }
                    // compute and set absolute paths for every content uri.
                    if (t.content) {
                        // transfert everything to contents..
                        t.contents = t.contents ?? [];
                        t.contents.push(t.content);
                    }
                    if (t.contents) {
                        for (const c of t.contents) {
                            let uri = c.uri;
                            if (PathUtils.IsRelativeUrl(uri)) {
                                uri = PathUtils.ResolveUri(baseUrl, uri);
                            }
                            c.uri = uri;
                        }
                    }
                    // recursively add childrens
                    if (t.children) {
                        parentTransform = t.worldTransform ?? IDENTITY44;
                        for (const subtile of t.children) {
                            subtile.parent = t;
                            localTransform = subtile.transform ?? IDENTITY44;
                            subtile.worldTransform = MulMat44(parentTransform, localTransform);

                            queue.enqueue(subtile);
                        }
                    }
                }
            } while (!queue.isEmpty());
        }

        return owner;
    }
}
