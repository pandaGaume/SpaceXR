import { Bounds } from "../../geometry/geometry.bounds";
import { IBounds, IBoundingBox, IBoundingSphere } from "../../geometry/geometry.interfaces";
import { ITile, ITile2DAddress } from "../../tiles/tiles.interfaces";
import { Nullable } from "../../types";
import { IStreamSource, IStreamSourceDependency, StreamSourceStatus } from "../streaming.datasource.interfaces";

/**
 * Default contentType for individual tile stream sources. Customize per layer
 * (e.g. "tile-address:imagery" / ":elevation") to route different layers to
 * different downstream consumers.
 */
export const TILE_STREAM_CONTENT_TYPE = "tile-address";

export interface ITileStreamSourceOptions {
    /** Tile address carried as the stream source's `content`. */
    address: ITile2DAddress;
    /** 3D bounding box in world frame (ECEF or flat plane, set by the pyramid). */
    boundingBox: IBounds;
    /** Optional bounding sphere. */
    boundingSphere?: IBoundingSphere;
    /** Geometric error (meters) used by SSE computations. Set by the pyramid. */
    geometricError: number;
    /** Namespace prefix for id uniqueness across layers. */
    namespace?: string;
    /** Override contentType. */
    contentType?: string;
    /** Initial status. Defaults to "pending". The loader flips to "ready" once content is fetched. */
    status?: StreamSourceStatus;
}

/**
 * IStreamSource<ITile2DAddress> : a single tile, tracked as a first-class
 * streaming entity with its own lifecycle (status).
 *
 * Emitted by `TilePyramidStreamSource` on camera-driven visibility changes.
 * Consumers (TileLoader adapters, scene renderers, diagnostics) can:
 *  - read `content` for the address
 *  - watch `status` transitions pending → downloading → ready / failed
 *  - use `boundingBox` for culling / placement (already in world frame)
 *  - read `geometricError` for priority / LOD decisions downstream
 *  - follow `dependencies` (parent quadkey) to resolve cross-tile replacement
 *  - read `tile` once `status === "ready"` to access the fetched `ITile<T>`
 *    (populated by `TileLoaderAdapter` when the fetch completes)
 */
export class TileStreamSource implements IStreamSource<ITile2DAddress> {
    public readonly kind = "static" as const;
    public readonly contentType: string;
    public readonly namespace?: string;
    public readonly encumbrance: IBoundingBox | IBoundingSphere;
    public readonly geometricError: number;
    public readonly dependencies?: ReadonlyArray<IStreamSourceDependency>;

    public status: StreamSourceStatus;
    public content?: ITile2DAddress | null;
    public boundingBox?: IBounds;
    public boundingSphere?: IBoundingSphere;
    /**
     * Fetched tile attached by a TileLoaderAdapter once the loader has
     * delivered content. `null` or `undefined` before then. The payload type
     * is erased (ITile<unknown>) because a stream may carry heterogeneous
     * layers ; consumers cast based on the `contentType`.
     */
    public tile?: Nullable<ITile<unknown>>;

    public constructor(options: ITileStreamSourceOptions) {
        this.contentType = options.contentType ?? TILE_STREAM_CONTENT_TYPE;
        this.namespace = options.namespace;
        this.content = options.address;
        this.boundingBox = options.boundingBox;
        this.encumbrance = options.boundingBox;
        this.geometricError = options.geometricError;
        this.boundingSphere = options.boundingSphere;
        this.status = options.status ?? "pending";
        // Cross-tile dep: coarser parent replaces at refinement boundary.
        const q = options.address.quadkey;
        if (q && q.length > 0) {
            const parent = q.slice(0, -1);
            const parentId = options.namespace ? `${options.namespace}:${parent}` : parent;
            this.dependencies = [{ op: "replace", target: parentId }];
        }
    }

    /** `<namespace>:<quadkey>` when namespace is set, else the quadkey alone. */
    public get id(): string {
        const q = this.content?.quadkey ?? "";
        return this.namespace ? `${this.namespace}:${q}` : q;
    }

    /** Convenience alias for `content`. */
    public get address(): ITile2DAddress | null {
        return this.content ?? null;
    }
}

/**
 * Builds a zero-bounds placeholder. Useful when a caller needs a TileStreamSource
 * reference before the 3D bounds have been computed.
 */
export function EmptyTileBounds(): IBounds {
    return Bounds.Zero();
}
