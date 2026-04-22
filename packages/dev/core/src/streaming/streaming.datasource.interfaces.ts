import { IBounded, IBounds, IBoundingBox, IBoundingSphere } from "../geometry";

/**
 * Fetch/activation state exposed on each IStreamSource. Scenes render only
 * datasources whose status is "ready"; other statuses are informational
 * (progress UI, retry policies, etc.).
 */
export enum StreamSourceStatus {
    idle, // initialized
    pending, // queued fro loading
    loading, // loading (ie-network operation in progress)
    ready, // loaded, content ready
    error, // on error after network operation
    unkknown = 999,
}

/**
 * A datasource is the unit of content referenced by an octree cell. It carries its
 * bounding volume (box or sphere), optional links describing how it composes with
 * other datasources, and its current status. The concrete payload is opaque to core.
 *
 * Status evolves over time and is mutated by the producer. Consumers observe the
 * evolution via the pipeline's update events (see ISourceBlock). `content` is
 * populated once status reaches "ready".
 */
export interface IStreamSource<T = unknown> extends IBounded {
    readonly id: string;
    readonly contentType: string;
    readonly encumbrance: IBoundingBox | IBoundingSphere;
    status: StreamSourceStatus;
    content?: T | null;
    boundingBox?: IBounds;
    boundingSphere?: IBoundingSphere;
}

export function IsStreamSource(b: unknown): b is IStreamSource {
    if (typeof b !== "object" || b === null) return false;
    const d = b as IStreamSource;
    return typeof d.id === "string" && d.encumbrance !== undefined && typeof d.contentType === "string" && typeof d.status === "string";
}
