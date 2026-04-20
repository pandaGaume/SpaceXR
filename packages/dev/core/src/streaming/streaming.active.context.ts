import { ICameraViewState } from "../camera";
import { PriorityQueue } from "../collections/priorityQueue";
import { IBoundingBox } from "../geometry";
import { IStreamSource } from "./streaming.datasource.interfaces";
import { IOctreeNode } from "../tree/tree.octree.interfaces";

/**
 * An entry living in the active cut : a source currently emitted for a given
 * view plus the latest priority (typically its screen-space error) computed
 * by the traversal. The priority drives refine/coarsen ordering under budget
 * pressure.
 *
 * Aging fields :
 *  - `activatedFrame` : frame on which the entry entered the cut. Used to
 *                       protect freshly-added entries from immediate coarsening
 *                       (see `minFramesBeforeCoarsen` on the engine).
 *  - `lastSeenFrame`  : last frame on which the traversal still produced this
 *                       entry. Stays fresh while the source is relevant ;
 *                       consumers can use it as an eviction hint (e.g. "keep
 *                       cached for N frames after disappearance").
 */
export interface IStreamActiveEntry {
    readonly source: IStreamSource<unknown>;
    priority: number;
    activatedFrame: number;
    lastSeenFrame: number;
}

/**
 * Per-view mutable state maintained by StreamingEngine.
 *
 * Matches the "cut / parents / frontier" terminology commonly used in 3DTiles
 * engines :
 *  - `cut`       : items currently emitted to consumers (the leaves of the
 *                  current selection).
 *  - `parents`   : octree cells whose decision was "refine" this frame
 *                  (ancestors of cut cells, kept for warm-start traversal).
 *  - `frontier`  : octree cells whose decision was "load" this frame (the
 *                  cells whose items populate `cut`).
 *  - `refinePQ`  : priority queue of candidate refine operations, ordered so
 *                  `dequeue` returns the highest-SSE item first (worst
 *                  offender = most urgent to refine).
 *  - `coarsenPQ` : priority queue of candidate coarsen operations, ordered so
 *                  `dequeue` returns the lowest-SSE item first (least useful
 *                  = safest to drop when coarsening is budgeted).
 *
 * `parents` and `frontier` are populated only by traversals that use the
 * octree (the engine's default `_traverse`). Custom sub-engines that walk
 * their own structure (tile pyramid, 3DTiles tree, …) simply leave them
 * untouched.
 */
export class StreamActiveContext {
    public camera: ICameraViewState | null = null;
    public clipBounds?: IBoundingBox;

    public readonly cut: Map<string, IStreamActiveEntry> = new Map();

    public readonly parents: Set<IOctreeNode<IStreamSource>> = new Set();
    public readonly frontier: Set<IOctreeNode<IStreamSource>> = new Set();

    public readonly refinePQ: PriorityQueue<IStreamActiveEntry>;
    public readonly coarsenPQ: PriorityQueue<IStreamActiveEntry>;

    /** Monotonic frame counter incremented on every `_refresh`. */
    public frame: number = 0;

    public constructor() {
        this.refinePQ = PriorityQueue.fromMax<IStreamActiveEntry>((e) => e.priority);
        this.coarsenPQ = PriorityQueue.fromMin<IStreamActiveEntry>((e) => e.priority);
    }

    /** Drops the octree warm-start frontier. Forces a cold traversal from the roots next frame. */
    public resetTraversalFrontier(): void {
        this.parents.clear();
        this.frontier.clear();
    }
}
