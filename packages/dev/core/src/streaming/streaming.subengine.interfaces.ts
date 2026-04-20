import { ICameraViewState } from "../camera";
import { ISourceBlock } from "../dataflow";
import { IBoundingBox } from "../geometry";
import { IDisposable } from "../types";
import { IStreamSource } from "./streaming.datasource.interfaces";

/**
 * Lifecycle contract for any "engine" driving a streaming pipeline. Shared by
 * the top-level StreamingEngine and the nested IStreamSubEngine, so inheritance
 * and composition stay uniform.
 *
 * Protocol:
 *  - `activate(viewId)` registers a view. The engine allocates per-view state.
 *  - `setContext(viewId, camera)` pushes camera updates. The engine diffs its
 *     visibility set and forwards setContext to every active sub-engine.
 *  - `deactivate(viewId)` tears down that view and emits REMOVE for everything
 *     it had on behalf of it.
 *
 * `setContext` is idempotent: calling it on an unregistered view auto-activates.
 * No reactive camera observable is involved; the host drives the cadence.
 */
export interface IStreamEngine extends IDisposable {
    activate(viewId: string): void;
    /**
     * Push an updated context for the given view. The engine re-traverses, diffs
     * its active set and forwards to every active sub-engine.
     *
     * `clipBounds` (optional) restricts selection to items whose bounds also
     * intersect the box, in addition to the frustum test performed by the
     * visibility policy. The same clipBounds is forwarded to sub-engines so the
     * whole hierarchy filters consistently.
     */
    setContext(viewId: string, camera: ICameraViewState, clipBounds?: IBoundingBox): void;
    deactivate(viewId: string): void;
    /** Number of views currently registered. */
    readonly activeViewCount: number;
}

/**
 * A stream source that is ALSO an engine: it carries its own internal traversal
 * logic (tile pyramid, 3D tile set, fleet cluster, …) and emits children
 * through the standard added / updated / removed triplet of ISourceBlock<T>.
 *
 * The parent StreamingEngine subscribes to a source only if it satisfies this
 * contract (runtime-tested by IsStreamSubEngine), then calls
 * `activate / setContext / deactivate` on it per visible view.
 */
export interface IStreamSubEngine<T = unknown> extends IStreamSource<T>, ISourceBlock<T>, IStreamEngine {}

export function IsStreamSubEngine<T = unknown>(b: unknown): b is IStreamSubEngine<T> {
    if (b === null || typeof b !== "object") return false;
    const s = b as IStreamSubEngine<T>;
    return typeof s.activate === "function" && typeof s.setContext === "function" && typeof s.deactivate === "function" && typeof s.activeViewCount === "number";
}
