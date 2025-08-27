import { Nullable } from "core/types";
import { ICameraViewState, ICodec, IDisplay, IHasDisplay, ISourceBlock, SourceBlock } from "core/tiles";
import { IBoundingVolume, ITile3d, ITileset } from "../interfaces";
import { TilesetCodec } from "../codecs";
import { Cartesian3, ICartesian3, IPlane } from "core/geometry";
import { Fifo } from "core/collections";

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
    isCompletelyInFrustum(frustumPlanes: IPlane[]): boolean;
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
        owner?: ITileset;
        parent?: ITile3d;
        worldTransform?: Mat44Type;
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

export interface ITransformManager<T> {}

export interface ITile3dContentManager<T> {}

export interface ITile3dStreamEngineContentOptions<T, M> {
    transformManager: ITransformManager<M>;
    contentManager: ITile3dContentManager<T>;
    codec: ICodec<ITileset>;
}

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
    private readonly _contentOptions: ITile3dStreamEngineContentOptions<T, M>;

    private _activeTiles = new Set<ITile3d>();
    private readonly _tileSets = new Map<string, ITileset>();
    private readonly _loadings = new Set<string>();

    // display
    private readonly _display: IDisplay;

    // Root loading coordination
    private _rootPromise: Promise<ITileset | null> | null = null;

    // Keep latest view-state to re-process after async loads
    private _pendingState: ICameraViewState | null = null;
    private _isProcessing = false;

    private _cartesianCache: Array<ICartesian3> = [Cartesian3.Zero()];

    public constructor(uri: string, display: IDisplay, contentOptions: ITile3dStreamEngineContentOptions<T, M>, navOptions?: ITile3dStreamEngineNavOptions) {
        super();
        this._uri = uri;
        this._display = display;
        this._contentOptions = contentOptions;
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
                const ts = await this._rootPromise;
                if (ts) {
                    this._initializeSet(ts); // this is where we link the nodes and set the worldTransform
                    if (ts.root) {
                        this._activeTiles.add(ts?.root);
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
                if (!tile) {
                    continue;
                }
                if (tile.geometricError === undefined || tile.boundingVolume === undefined) {
                    return;
                }

                // we compute the distance from the camera, using the center of the bounding volume
                // which may be a box, a sphere or a region. For region we must know the reference system such ECEF or ENU
                // This information is provided as an options.
                // Default reference frame is ECEF (Earth-Centered, Earth-Fixed) with the WGS84 ellipsoid.
                const center = this._cartesianCache[0];
                this._getWorldCenterToRef(tile.boundingVolume, center);
                const distanceToCamera = Cartesian3.Distance(center, state.worldPosition);

                const fn = this._navOptions.screenSpaceError ?? ScreenSpaceError;
                const sse = fn(tile.geometricError, distanceToCamera, this._display.resolution.height, state.tanFov2);
                if (sse > this._navOptions.maxScreenSpaceError) {
                    // refine.
                    const refine = tile.refine ?? "REPLACE";
                    if (refine === "REPLACE") {
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
                    if (tile.parent) {
                        if (!toProcess.includes(tile.parent)) {
                            // enqueue only if not already in
                            toProcess.enqueue(tile.parent);
                        }
                    }
                    if (this._activeTiles.has(tile)) {
                        toRemove.push(tile);
                    }
                    continue;
                }

                // keep the tile activ or add it
                if (!this._activeTiles.has(tile)) {
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

    protected _getWorldCenterToRef(bv: IBoundingVolume, ref: ICartesian3): void {}

    protected async _loadSetAsync(uri: string, signal?: AbortSignal): Promise<Nullable<ITileset>> {
        if (this._loadings.has(uri)) return null;
        this._loadings.add(uri);
        try {
            const ts = await this._loadSet0Async(uri, signal);
            if (signal?.aborted) return null; // caller cancelled; don't cache
            if (ts) {
                this._tileSets.set(uri, ts);
            }
            return ts ?? null;
        } catch (err) {
            // If aborted, swallow..
            if ((err as DOMException)?.name === "AbortError") return null;
            throw err;
        } finally {
            this._loadings.delete(uri);
        }
    }

    // TODO : Replace with WebClient !!
    protected async _loadSet0Async(uri: string, signal?: AbortSignal): Promise<Nullable<ITileset>> {
        const codec = this._contentOptions.codec ?? TilesetCodec.Shared;
        const res = await fetch(uri, { signal });
        if (!res.ok) throw new Error(`Failed to load ${uri} (${res.status})`);
        return codec.decodeAsync(res);
    }

    protected _initializeSet(tileset: ITileset, from?: ITile3d) {}
}
