import { IBounded, IBounds, IBoundingBox, IBoundingSphere } from "../geometry";

/**
 * How a datasource combines with the datasource(s) it targets through a link.
 * - replace: the new source replaces the target in the active set
 * - add: the new source stacks on top of the target (both remain active)
 * - modify: the new source mutates or augments the target (e.g. adds detail, overrides attributes)
 */
export type StreamSourceDependencyOp = "replace" | "add" | "modify";

export interface IStreamSourceDependency {
    readonly op: StreamSourceDependencyOp;
    /** Id of the target datasource. */
    readonly target: string;
}

/**
 * Kind of payload a datasource carries. Drives which producer is selected.
 * - static: a finite, self-contained payload (mesh, point cloud chunk, image, etc.)
 * - provider: the datasource is a spawner backed by a sub-pipeline (e.g. a tile
 *             pyramid). Its producer creates child IStreamSource instances on
 *             camera moves and emits them through the streaming pipeline.
 */
export type StreamSourceKind = "static" | "provider";

/**
 * Fetch/activation state exposed on each IStreamSource. Scenes render only
 * datasources whose status is "ready"; other statuses are informational
 * (progress UI, retry policies, etc.).
 */
export type StreamSourceStatus = "pending" | "downloading" | "ready" | "failed" | "failed-permanently";

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
    readonly kind: StreamSourceKind;
    readonly contentType: string;
    readonly encumbrance: IBoundingBox | IBoundingSphere;
    readonly dependencies?: ReadonlyArray<IStreamSourceDependency>;
    status: StreamSourceStatus;
    content?: T | null;
    boundingBox?: IBounds;
    boundingSphere?: IBoundingSphere;
}

export function IsStreamSource(b: unknown): b is IStreamSource {
    if (typeof b !== "object" || b === null) return false;
    const d = b as IStreamSource;
    return typeof d.id === "string" && typeof d.kind === "string" && d.encumbrance !== undefined && typeof d.contentType === "string" && typeof d.status === "string";
}
