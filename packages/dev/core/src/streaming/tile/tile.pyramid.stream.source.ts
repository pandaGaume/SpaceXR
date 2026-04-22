import { ICameraViewState } from "../../camera";
import { Ellipsoid } from "../../geodesy/geodesy.ellipsoid";
import { GeodeticSystem } from "../../geodesy/geodesy.system";
import { IBounds, IBoundingBox, IBoundingSphere, ICartesian3, IsBounds, DeriveBounds } from "../../geometry/geometry.interfaces";
import { ITile2DAddress, ITileMetrics } from "../../tiles/tiles.interfaces";
import { TileAddress } from "../../tiles/address/tiles.address";
import { IStreamSource, StreamSourceStatus } from "../streaming.datasource.interfaces";
import { IStreamActiveEntry, StreamActiveContext } from "../streaming.active.context";
import { IntersectsBoundingBox, StreamingEngine } from "../streaming.engine";
import { IStreamSubEngine } from "../streaming.subengine.interfaces";
import { IScreenSpaceErrorBudget, ResolveSSEBudget } from "../streaming.visibility.budget";
import { IsBeyondHorizon } from "../streaming.visibility.overflight";
import { IOctreeNode } from "../../tree/tree.octree.interfaces";
import { TileStreamSource } from "./tile.stream.source";

/**
 * contentType for stream sources wrapping a 2D tile pyramid.
 */
export const TILE_PYRAMID_CONTENT_TYPE = "tile-pyramid";

export interface ITilePyramidStreamSourceOptions {
    id: string;
    /** Tile metrics of the pyramid (EPSG3857, WGS84 quadtree, custom, …). */
    metrics: ITileMetrics;
    /** Spatial extent used by the octree. Accepts a box or a sphere. */
    encumbrance: IBoundingBox | IBoundingSphere;
    /**
     * When set, tile bounds are computed in ECEF using this ellipsoid. Supports any
     * planet (Earth, Moon, Mars, …) via the presets in core/geodesy. When omitted,
     * the pyramid falls back to flat point-XY bounds (holographic plane maps).
     */
    ellipsoid?: Ellipsoid;
    /**
     * Max pixel screen-space error before a tile is refined. Accepts either a
     * plain number (constant threshold) or an IScreenSpaceErrorBudget for
     * altitude-varying thresholds. Defaults to a constant 16.
     */
    maxScreenSpaceError?: number | IScreenSpaceErrorBudget;
    /**
     * Enable horizon-occlusion culling. Defaults to true when `ellipsoid` is
     * provided (tiles on the far side of the planet are culled before any SSE
     * computation). Ignored in flat mode.
     */
    horizonCull?: boolean;
    /**
     * Sphere center in world space when `ellipsoid` is set. Defaults to the
     * origin (0, 0, 0), matching standard ECEF conventions.
     */
    sphereCenter?: ICartesian3;
    /** Optional explicit bounding box of the root region. Derived from `encumbrance` when absent. */
    boundingBox?: IBounds;
    /** Override the default contentType (e.g. "tile-pyramid:imagery"). */
    contentType?: string;
    /** contentType applied to each emitted TileStreamSource child. Default `"tile-address"`. */
    childContentType?: string;
}

/**
 * A tile pyramid modelled as a nested StreamingEngine: it traverses its own
 * implicit quadtree from the root using frustum + screen-space error tests
 * (via `core/geodesy.Ellipsoid` when a planet is specified, flat point-XY
 * otherwise) and emits `TileStreamSource` children through the inherited
 * SourceBlock.
 *
 * Being an IStreamSubEngine AND a StreamingEngine, it plays two roles at once:
 *  - As an IStreamSource inside an octree, it is activated / deactivated by
 *    the parent StreamingEngine when the octree cell becomes (in)visible.
 *  - As an IStreamEngine itself, it manages per-view state and forwards
 *    `setContext` from the parent to its own traversal.
 *
 * Hosts wire it to a downstream consumer (typically an adapter over the
 * existing ITileLoader) via `pyramid.linkTo(tileLoader)`.
 */
export class TilePyramidStreamSource extends StreamingEngine implements IStreamSubEngine<IStreamSource<unknown>> {
    public static readonly DefaultMaxScreenSpaceError = 16;

    // IStreamSource -------------------------------------------------
    public readonly id: string;
    public readonly kind = "provider" as const;
    public readonly contentType: string;
    public readonly encumbrance: IBoundingBox | IBoundingSphere;
    public status: StreamSourceStatus = StreamSourceStatus.ready;
    /** The pyramid is an aggregate, not a single tile; content is always null. */
    public content?: IStreamSource<unknown> | null = null;
    public boundingBox?: IBounds;
    public boundingSphere?: IBoundingSphere;

    private readonly _metrics: ITileMetrics;
    private readonly _ellipsoid?: Ellipsoid;
    private readonly _geodetic?: GeodeticSystem;
    private readonly _sphereCenter: ICartesian3;
    private readonly _sphereRadius: number;
    private readonly _horizonCull: boolean;
    private readonly _budget: IScreenSpaceErrorBudget;
    private readonly _childContentType: string;

    public constructor(options: ITilePyramidStreamSourceOptions) {
        super({}); // no octrees: pyramid's _traverse walks its own quadtree
        this.id = options.id;
        this.contentType = options.contentType ?? TILE_PYRAMID_CONTENT_TYPE;
        this.encumbrance = options.encumbrance;
        this._metrics = options.metrics;
        this._ellipsoid = options.ellipsoid;
        this._geodetic = options.ellipsoid ? new GeodeticSystem(options.ellipsoid) : undefined;
        this._sphereCenter = options.sphereCenter ?? { x: 0, y: 0, z: 0 };
        this._sphereRadius = options.ellipsoid?.semiMajorAxis ?? 0;
        this._horizonCull = options.horizonCull ?? !!options.ellipsoid;
        this._budget = ResolveSSEBudget(options.maxScreenSpaceError ?? TilePyramidStreamSource.DefaultMaxScreenSpaceError);
        this._childContentType = options.childContentType ?? "tile-address";

        this.boundingBox = options.boundingBox ?? DeriveBounds(options.encumbrance);
        if (!IsBounds(options.encumbrance)) {
            this.boundingSphere = options.encumbrance as IBoundingSphere;
        }
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get ellipsoid(): Ellipsoid | undefined {
        return this._ellipsoid;
    }

    protected override _traverse(
        camera: ICameraViewState,
        ctx: StreamActiveContext,
        _parentsOut: Set<IOctreeNode<IStreamSource>>,
        _frontierOut: Set<IOctreeNode<IStreamSource>>,
        entriesOut: Map<string, IStreamActiveEntry>
    ): void {
        const maxSSE = this._budget.getMaxSSE(this._cameraAltitude(camera));
        this._walk(new TileAddress(0, 0, this._metrics.minLOD), camera, ctx.clipBounds, maxSSE, entriesOut);
    }

    private _walk(
        address: ITile2DAddress | Array<ITile2DAddress>,
        camera: ICameraViewState,
        clipBounds: IBoundingBox | undefined,
        maxSSE: number,
        out: Map<string, IStreamActiveEntry>
    ): void {
        if (Array.isArray(address)) {
            for (const a of address) {
                this._walk(a, camera, clipBounds, maxSSE, out);
            }
            return;
        }
        if (address.levelOfDetail > this._metrics.maxLOD) return;

        const bounds = this._computeBounds(address);
        if (!bounds) return;

        // Spatial clip : skip sub-trees outside the requested box.
        if (clipBounds && !IntersectsBoundingBox(bounds, clipBounds)) return;

        // Horizon cull when flying a planet : tile is on the far side of the
        // sphere, invisible whatever the frustum says.
        if (this._horizonCull && this._sphereRadius > 0) {
            if (IsBeyondHorizon(bounds.center, camera.worldPosition, this._sphereCenter, this._sphereRadius)) return;
        }

        if (camera.isInFrustum && !camera.isInFrustum(bounds)) return;

        const geometricError = TileAddress.GeometricError(address, this._metrics);
        const sse = this._computeSSE(bounds, geometricError, camera);

        if (sse <= maxSSE || address.levelOfDetail >= this._metrics.maxLOD) {
            const tile = new TileStreamSource({
                address,
                boundingBox: bounds,
                geometricError,
                namespace: this.id,
                contentType: this._childContentType,
            });
            // activatedFrame / lastSeenFrame are stamped by the engine on actual
            // promotion to the cut ; seed them to -1 so the aging check treats
            // this tile as a fresh candidate.
            out.set(tile.id, { source: tile, priority: sse, activatedFrame: -1, lastSeenFrame: -1 });
            return;
        }

        const child = TileAddress.Split(address, this._metrics);
        if (child?.length) {
            this._walk(child, camera, clipBounds, maxSSE, out);
        }
    }

    /** Camera altitude above the map surface. Flat : Z of worldPosition. Sphere : |cam − center| − R. */
    private _cameraAltitude(camera: ICameraViewState): number {
        if (this._sphereRadius > 0) {
            const dx = camera.worldPosition.x - this._sphereCenter.x;
            const dy = camera.worldPosition.y - this._sphereCenter.y;
            const dz = camera.worldPosition.z - this._sphereCenter.z;
            return Math.max(Math.hypot(dx, dy, dz) - this._sphereRadius, 0);
        }
        return camera.worldPosition.z;
    }

    private _computeBounds(address: ITile2DAddress): IBounds | undefined {
        if (this._ellipsoid && this._geodetic) {
            return TileAddress.ToBoundsECEF(address, this._metrics, this._ellipsoid, this._geodetic);
        }
        return TileAddress.ToBounds(address, this._metrics);
    }

    private _computeSSE(bounds: IBounds, geometricError: number, camera: ICameraViewState): number {
        const cx = bounds.center.x - camera.worldPosition.x;
        const cy = bounds.center.y - camera.worldPosition.y;
        const cz = bounds.center.z - camera.worldPosition.z;
        const radius = Math.max(bounds.extendSize.x, bounds.extendSize.y, bounds.extendSize.z);
        const distance = Math.max(Math.hypot(cx, cy, cz) - radius, 1e-6);
        const tan = camera.tanFov2 > 0 ? camera.tanFov2 : Math.tan((camera.fovY || 0) * 0.5);
        const vh = camera.viewportHeight && camera.viewportHeight > 0 ? camera.viewportHeight : 1080;
        if (tan <= 0 || vh <= 0) return 0;
        return (geometricError * vh) / (distance * 2 * tan);
    }
}
