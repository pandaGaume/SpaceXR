import { Bounds } from "../../geometry/geometry.bounds";
import { IBounds, IBoundingBox, IBoundingSphere, IsBounds } from "../../geometry/geometry.interfaces";
import { AbstractTileLoader } from "../../tiles/loaders/tiles.loader.abstract";
import { StreamSourceStatus, IStreamSource, IStreamSourceLink } from "../streaming.datasource.interfaces";
import { AbstractStreamSourceProducer } from "../streaming.producer.abstract";

/**
 * Default contentType for provider-backed datasources. Customize per concrete
 * tile content (e.g. "tile-provider:imagery") when the scene needs to route
 * different providers through different producers.
 */
export const TILE_STREAM_CONTENT_TYPE = "tile-provider";

export interface ITileStreamSourceOptions<T> {
    id: string;
    provider: AbstractTileLoader<T>;
    encumbrance: IBoundingBox | IBoundingSphere;
    /** Optional concrete bounding box used to insert this datasource into an Octree. */
    boundingBox?: IBounds;
    /** Optional links to other datasources (replace / add / modify). */
    links?: ReadonlyArray<IStreamSourceLink>;
    /** Override the default contentType. Useful to split routing by payload type. */
    contentType?: string;
}

/**
 * IStreamSource wrapper around an existing AbstractTileLoader.
 *
 * Design note: one provider maps to ONE datasource sitting in ONE octree cell.
 * The 2D tile pyramid is never materialized inside the octree; it stays implicit,
 * driven by tile addresses and the existing ITileView → AbstractTileLoader pipeline.
 *
 * Two independent LOD systems coexist and do not conflict:
 *  - Octree LOD (this module): decides when the whole provider region is relevant
 *    for a given camera. It toggles the provider ON / OFF via activate / deactivate.
 *  - Tile pyramid LOD (tiles/pipeline): runs only while the provider is active and
 *    selects the right zoom level / tile addresses based on navigation state.
 *
 * This keeps the octree small (one cell per provider, not millions of tile cells)
 * and reuses the entire tiles/loaders + tiles/pipeline machinery as-is.
 */
export class TileStreamSource<T = unknown> implements IStreamSource<AbstractTileLoader<T>> {
    private static _deriveBounds(enc: IBoundingBox | IBoundingSphere): IBounds | undefined {
        if (IsBounds(enc)) return enc;
        const box = enc as IBoundingBox;
        if (box.minimum && box.maximum) {
            const w = box.maximum.x - box.minimum.x;
            const h = box.maximum.y - box.minimum.y;
            const d = box.maximum.z - box.minimum.z;
            return new Bounds(box.minimum.x, box.minimum.y, w, h, box.minimum.z, d);
        }
        const sphere = enc as IBoundingSphere;
        if (sphere.center && typeof sphere.radius === "number") {
            const r = sphere.radius;
            return new Bounds(sphere.center.x - r, sphere.center.y - r, 2 * r, 2 * r, sphere.center.z - r, 2 * r);
        }
        return undefined;
    }

    public readonly id: string;
    public readonly kind = "provider" as const;
    public readonly contentType: string;
    public readonly encumbrance: IBoundingBox | IBoundingSphere;
    public readonly links?: ReadonlyArray<IStreamSourceLink>;
    public readonly provider: AbstractTileLoader<T>;

    public status: StreamSourceStatus = "pending";
    public content?: AbstractTileLoader<T> | null = null;
    public boundingBox?: IBounds;
    public boundingSphere?: IBoundingSphere;

    public constructor(options: ITileStreamSourceOptions<T>) {
        this.id = options.id;
        this.provider = options.provider;
        this.encumbrance = options.encumbrance;
        this.links = options.links;
        this.contentType = options.contentType ?? TILE_STREAM_CONTENT_TYPE;
        this.boundingBox = options.boundingBox ?? TileStreamSource._deriveBounds(options.encumbrance);
        if (!IsBounds(options.encumbrance)) {
            this.boundingSphere = options.encumbrance as IBoundingSphere;
        }
    }
}

/**
 * Placeholder 1:1 producer for TileStreamSource.
 *
 * This version emits the provider as the `content` of the TileStreamSource
 * itself (status: pending → downloading → ready). Scenes can listen to the
 * activation and wire the provider into their own tile consumer via the existing
 * tiles/pipeline machinery.
 *
 * TODO (phase 3): replace with a proper spawner that instantiates an ITileView
 * per (viewId, provider) and emits Tile2DDataSource children as addresses flow.
 * See streaming.tile2d.ts (to be added).
 */
export class TileStreamSourceProducer extends AbstractStreamSourceProducer<AbstractTileLoader<unknown>> {
    public readonly contentType: string;

    public constructor(contentType: string = TILE_STREAM_CONTENT_TYPE) {
        super();
        this.contentType = contentType;
    }

    protected _load(source: IStreamSource<AbstractTileLoader<unknown>>): Promise<AbstractTileLoader<unknown>> {
        const provider = (source as TileStreamSource<unknown>).provider;
        return Promise.resolve(provider);
    }
}
