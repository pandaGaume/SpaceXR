import { IBounded, IBounds, IBoundingBox, IBoundingSphere } from "../geometry";

/**
 * How a datasource combines with the datasource(s) it targets through a link.
 * - replace: the new source replaces the target in the active set
 * - add: the new source stacks on top of the target (both remain active)
 * - modify: the new source mutates or augments the target (e.g. adds detail, overrides attributes)
 */
export type StreamSourceLinkOp = "replace" | "add" | "modify";

export interface IStreamSourceLink {
    readonly op: StreamSourceLinkOp;
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
export type StreamSourceStatus = "pending" | "downloading" | "ready" | "failed" | "failed-permanently" | "deactivated";

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
    readonly links?: ReadonlyArray<IStreamSourceLink>;
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

/**
 * Lifecycle operation emitted by the engine for a datasource within a given view.
 * - load: fetch bytes / build CPU-side representation (no scene effect yet)
 * - activate: insert into the scene (implies load if not already loaded)
 * - update: still active but its bounds/state changed (typical for moving assets)
 * - deactivate: remove from the scene but keep loaded
 * - unload: drop from memory (implies deactivate)
 */
export type StreamSourceOperation = "load" | "activate" | "update" | "deactivate" | "unload";

/**
 * Event payload flowing from Engine to View (and from View to Producer).
 * Carries the datasource, the operation to apply, a priority hint and the target view id.
 */
export interface IStreamSourceActivation {
    readonly source: IStreamSource;
    readonly operation: StreamSourceOperation;
    readonly priority: number;
    readonly viewId: string;
    /** Optional context hint: the octree cell that triggered this activation. */
    readonly cellId?: string;
}
