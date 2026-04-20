import { ICameraViewState } from "../camera";
import { Observer } from "../events";
import { IBoundingBox } from "../geometry";
import { SourceBlock } from "../tiles/pipeline/tiles.pipeline.sourceblock";
import { IDisposable } from "../types";
import { IObservableOctree, IOctreeNode, IVisibilityPolicy } from "../tree/tree.octree.interfaces";
import { IStreamActiveEntry, StreamActiveContext } from "./streaming.active.context";
import { IStreamSource } from "./streaming.datasource.interfaces";
import { IStreamEngine, IStreamSubEngine, IsStreamSubEngine } from "./streaming.subengine.interfaces";
import { ScreenSpaceErrorPolicy } from "./streaming.visibility.sse";

/**
 * AABB intersection test on two IBoundingBox (min/max). Inclusive on the edges.
 */
export function IntersectsBoundingBox(a: IBoundingBox, b: IBoundingBox): boolean {
    return (
        a.minimum.x <= b.maximum.x &&
        a.maximum.x >= b.minimum.x &&
        a.minimum.y <= b.maximum.y &&
        a.maximum.y >= b.minimum.y &&
        a.minimum.z <= b.maximum.z &&
        a.maximum.z >= b.minimum.z
    );
}

export interface IStreamingEngineOptions {
    /** Shared octrees traversed by the default implementation. Can be empty for subclasses that override `_traverse`. */
    octrees?: ReadonlyArray<IObservableOctree<IStreamSource>>;
    /** Fallback visibility policy for octree cells that do not declare their own. */
    defaultPolicy?: IVisibilityPolicy<IStreamSource>;
    /** Maximum sources to activate per frame. Defaults to unlimited (Number.POSITIVE_INFINITY). */
    maxRefinePerFrame?: number;
    /** Maximum sources to deactivate per frame. Defaults to unlimited. */
    maxCoarsenPerFrame?: number;
    /**
     * Minimum number of frames a freshly-added entry stays in the cut before
     * it becomes eligible for coarsening. Stops entries from being activated
     * and deactivated on back-to-back frames (common when the camera hovers
     * on a SSE threshold). Default 0 = no protection.
     */
    minFramesBeforeCoarsen?: number;
}

/**
 * Multi-view streaming engine.
 *
 * Drives the streaming pipeline for one or more cameras through explicit
 * `setContext(viewId, camera, clipBounds?)` pushes.
 *
 * Each refresh :
 *  1. Full traversal populates `cut` candidates (desired set).
 *  2. Diff vs the current cut seeds the `refinePQ` (new sources, max-SSE first)
 *     and `coarsenPQ` (dropped sources, min-SSE first) of the view's
 *     `StreamActiveContext`.
 *  3. Up to `maxRefinePerFrame` items are dequeued from `refinePQ` and
 *     activated ; up to `maxCoarsenPerFrame` from `coarsenPQ` and
 *     deactivated. Leftovers are seen again next frame (lazy convergence).
 *  4. `setContext(viewId, camera, clipBounds)` is forwarded to every active
 *     sub-engine so they refresh their own sub-traversal.
 *
 * The default `_traverse` walks the configured octrees with the given policy
 * and is designed to be overridden by subclasses that model their own spatial
 * structure (quadtree + ellipsoid for `TilePyramidStreamSource`, for example).
 */
export class StreamingEngine extends SourceBlock<IStreamSource<unknown>> implements IStreamEngine, IDisposable {
    protected readonly _octrees: ReadonlyArray<IObservableOctree<IStreamSource>>;
    protected readonly _defaultPolicy: IVisibilityPolicy<IStreamSource>;
    protected readonly _views: Map<string, StreamActiveContext> = new Map();
    protected readonly _activeSubEngines: Set<IStreamSubEngine<unknown>> = new Set();
    private readonly _maxRefinePerFrame: number;
    private readonly _maxCoarsenPerFrame: number;
    private readonly _minFramesBeforeCoarsen: number;
    private _octreeObservers: Array<Observer<any>> = [];

    public constructor(options: IStreamingEngineOptions = {}) {
        super();
        this._octrees = options.octrees ?? [];
        this._defaultPolicy = options.defaultPolicy ?? new ScreenSpaceErrorPolicy<IStreamSource>();
        this._maxRefinePerFrame = options.maxRefinePerFrame ?? Number.POSITIVE_INFINITY;
        this._maxCoarsenPerFrame = options.maxCoarsenPerFrame ?? Number.POSITIVE_INFINITY;
        this._minFramesBeforeCoarsen = Math.max(0, options.minFramesBeforeCoarsen ?? 0);

        for (const tree of this._octrees) {
            const onAdded = tree.addedObservable.add(() => this._onOctreeChanged());
            const onRemoved = tree.removedObservable.add(() => this._onOctreeChanged());
            const onUpdated = tree.updatedObservable.add(() => this._onOctreeChanged());
            if (onAdded) this._octreeObservers.push(onAdded);
            if (onRemoved) this._octreeObservers.push(onRemoved);
            if (onUpdated) this._octreeObservers.push(onUpdated);
        }
    }

    public get activeViewCount(): number {
        return this._views.size;
    }

    public get maxRefinePerFrame(): number {
        return this._maxRefinePerFrame;
    }

    public get maxCoarsenPerFrame(): number {
        return this._maxCoarsenPerFrame;
    }

    public activate(viewId: string): void {
        if (this._views.has(viewId)) return;
        this._views.set(viewId, new StreamActiveContext());
    }

    public setContext(viewId: string, camera: ICameraViewState, clipBounds?: IBoundingBox): void {
        let ctx = this._views.get(viewId);
        if (!ctx) {
            this.activate(viewId);
            ctx = this._views.get(viewId)!;
        }
        ctx.camera = camera;
        ctx.clipBounds = clipBounds;
        this._refresh(viewId, ctx);
    }

    public deactivate(viewId: string): void {
        const ctx = this._views.get(viewId);
        if (!ctx) return;
        const removed: IStreamSource[] = [];
        for (const entry of ctx.cut.values()) {
            if (IsStreamSubEngine(entry.source)) {
                const se = entry.source as IStreamSubEngine<unknown>;
                se.deactivate(viewId);
                if (se.activeViewCount === 0) this._activeSubEngines.delete(se);
            }
            removed.push(entry.source);
        }
        this._views.delete(viewId);
        if (removed.length > 0) this.notifyRemoved(removed);
    }

    public override dispose(): void {
        for (const viewId of Array.from(this._views.keys())) this.deactivate(viewId);
        this._activeSubEngines.clear();
        for (const o of this._octreeObservers) o.disconnect();
        this._octreeObservers = [];
        super.dispose();
    }

    /**
     * Drops the octree warm-start frontier for one view (or all). Next refresh
     * runs a cold traversal from the octree roots.
     */
    public resetTraversalCache(viewId?: string): void {
        if (viewId) {
            this._views.get(viewId)?.resetTraversalFrontier();
            return;
        }
        for (const ctx of this._views.values()) ctx.resetTraversalFrontier();
    }

    /** Read-only view of a context's cut (for diagnostics). */
    public getActiveSources(viewId: string): ReadonlyMap<string, IStreamSource> | undefined {
        const ctx = this._views.get(viewId);
        if (!ctx) return undefined;
        const out = new Map<string, IStreamSource>();
        for (const [id, entry] of ctx.cut) out.set(id, entry.source);
        return out;
    }

    // ───────── refresh / diff / forwarding ─────────

    protected _refresh(viewId: string, ctx: StreamActiveContext): void {
        if (!ctx.camera) return;

        ctx.frame++;
        const frame = ctx.frame;

        // Reset octree frontier for this refresh. Traversal will re-populate.
        const nextParents = new Set<IOctreeNode<IStreamSource>>();
        const nextFrontier = new Set<IOctreeNode<IStreamSource>>();
        const nextEntries = new Map<string, IStreamActiveEntry>();
        this._traverse(ctx.camera, ctx, nextParents, nextFrontier, nextEntries);

        // Swap in fresh octree frontier immediately : it tracks traversal state,
        // not emission state, and next frame's warm-start reads it directly.
        ctx.parents.clear();
        for (const n of nextParents) ctx.parents.add(n);
        ctx.frontier.clear();
        for (const n of nextFrontier) ctx.frontier.add(n);

        // Build refine / coarsen queues from the diff.
        ctx.refinePQ.clear();
        ctx.coarsenPQ.clear();
        for (const [id, entry] of nextEntries) {
            if (!ctx.cut.has(id)) ctx.refinePQ.enqueue(entry);
        }
        for (const [id, entry] of ctx.cut) {
            if (!nextEntries.has(id)) {
                // Min-age gate : freshly-added entries survive at least a few frames
                // to avoid activation/deactivation oscillation near a SSE threshold.
                if (this._minFramesBeforeCoarsen > 0 && frame - entry.activatedFrame < this._minFramesBeforeCoarsen) {
                    continue;
                }
                ctx.coarsenPQ.enqueue(entry);
            }
        }

        // Apply per-frame budgets. Leftovers survive to next refresh via the diff.
        const addedSources: IStreamSource[] = [];
        let refineBudget = this._maxRefinePerFrame;
        while (refineBudget > 0 && !ctx.refinePQ.isEmpty()) {
            const entry = ctx.refinePQ.dequeue();
            if (!entry) break;
            entry.activatedFrame = frame;
            entry.lastSeenFrame = frame;
            ctx.cut.set(entry.source.id, entry);
            if (IsStreamSubEngine(entry.source)) {
                const se = entry.source as IStreamSubEngine<unknown>;
                se.activate(viewId);
                this._activeSubEngines.add(se);
            }
            addedSources.push(entry.source);
            refineBudget--;
        }

        const removedSources: IStreamSource[] = [];
        let coarsenBudget = this._maxCoarsenPerFrame;
        while (coarsenBudget > 0 && !ctx.coarsenPQ.isEmpty()) {
            const entry = ctx.coarsenPQ.dequeue();
            if (!entry) break;
            ctx.cut.delete(entry.source.id);
            if (IsStreamSubEngine(entry.source)) {
                const se = entry.source as IStreamSubEngine<unknown>;
                se.deactivate(viewId);
                if (se.activeViewCount === 0) this._activeSubEngines.delete(se);
            }
            removedSources.push(entry.source);
            coarsenBudget--;
        }

        // Refresh stored priorities + lastSeenFrame of entries still present on
        // both sides (their SSE moved as the camera moved, they are still alive).
        for (const [id, entry] of ctx.cut) {
            const next = nextEntries.get(id);
            if (next) {
                entry.priority = next.priority;
                entry.lastSeenFrame = frame;
            }
        }

        // Forward the fresh context to every currently-active sub-engine. Each
        // sub-engine no-ops on viewIds it has not activated.
        for (const se of this._activeSubEngines) {
            se.setContext(viewId, ctx.camera, ctx.clipBounds);
        }

        if (addedSources.length > 0) this.notifyAdded(addedSources);
        if (removedSources.length > 0) this.notifyRemoved(removedSources);
    }

    // ───────── traversal (overridable) ─────────

    /**
     * Default octree-based traversal : walks from the frontier anchors (or the
     * octree roots on a cold start), applies per-cell visibility policies and
     * collects leaf items with their cell-level priority.
     *
     * Subclasses override this when their engine does not use an octree (e.g.
     * a tile pyramid traverses its implicit quadtree with a per-tile SSE).
     * Octree-specific `parentsOut` / `frontierOut` populate the `parents` and
     * `frontier` sets of `StreamActiveContext` ; subclasses may leave them empty.
     */
    protected _traverse(
        camera: ICameraViewState,
        ctx: StreamActiveContext,
        parentsOut: Set<IOctreeNode<IStreamSource>>,
        frontierOut: Set<IOctreeNode<IStreamSource>>,
        entriesOut: Map<string, IStreamActiveEntry>
    ): void {
        const visited = new Set<IOctreeNode<IStreamSource>>();
        const starts = this._computeStartCells(ctx);
        for (const start of starts) {
            this._traverseNode(start, camera, ctx.clipBounds, visited, parentsOut, frontierOut, entriesOut);
        }
    }

    private _traverseNode(
        node: IOctreeNode<IStreamSource>,
        camera: ICameraViewState,
        clipBounds: IBoundingBox | undefined,
        visited: Set<IOctreeNode<IStreamSource>>,
        parentsOut: Set<IOctreeNode<IStreamSource>>,
        frontierOut: Set<IOctreeNode<IStreamSource>>,
        entriesOut: Map<string, IStreamActiveEntry>
    ): void {
        if (visited.has(node)) return;
        visited.add(node);

        // clipBounds pre-filter : skip whole sub-trees outside the requested region.
        if (clipBounds && node.boundingBox && !IntersectsBoundingBox(node.boundingBox, clipBounds)) {
            return;
        }

        const policy = node.resolveVisibilityPolicy?.() ?? this._defaultPolicy;
        const decision = policy.evaluate(node, camera);

        switch (decision.kind) {
            case "cull":
                return;
            case "load": {
                frontierOut.add(node);
                const priority = decision.priority ?? 0;
                this._collectSubtree(node, clipBounds, priority, entriesOut);
                return;
            }
            case "refine":
                if (node.children && node.children.length > 0) {
                    parentsOut.add(node);
                    for (const c of node.children) {
                        this._traverseNode(c, camera, clipBounds, visited, parentsOut, frontierOut, entriesOut);
                    }
                } else {
                    frontierOut.add(node);
                    const priority = decision.priority ?? 0;
                    this._collectSubtree(node, clipBounds, priority, entriesOut);
                }
                return;
        }
    }

    private _computeStartCells(ctx: StreamActiveContext): Array<IOctreeNode<IStreamSource>> {
        if (ctx.parents.size === 0 && ctx.frontier.size === 0) {
            return this._octrees.map((t) => t.root);
        }
        const starts = new Set<IOctreeNode<IStreamSource>>();
        const push = (cell: IOctreeNode<IStreamSource>) => {
            const anchor = (cell.parent as IOctreeNode<IStreamSource> | null | undefined) ?? cell;
            starts.add(anchor);
        };
        for (const cell of ctx.parents) push(cell);
        for (const cell of ctx.frontier) push(cell);
        return Array.from(starts);
    }

    private _collectSubtree(node: IOctreeNode<IStreamSource>, clipBounds: IBoundingBox | undefined, priority: number, out: Map<string, IStreamActiveEntry>): void {
        if (node.items) {
            for (const item of node.items.data) {
                if (clipBounds && item.boundingBox && !IntersectsBoundingBox(item.boundingBox, clipBounds)) continue;
                const existing = out.get(item.id);
                if (existing) {
                    if (priority > existing.priority) existing.priority = priority;
                } else {
                    // activatedFrame / lastSeenFrame are stamped when the entry actually
                    // enters the cut in `_refresh` ; seed them to -1 so the aging check
                    // treats this as a candidate (not yet promoted).
                    out.set(item.id, { source: item, priority, activatedFrame: -1, lastSeenFrame: -1 });
                }
            }
        }
        if (node.children) {
            for (const c of node.children) {
                if (clipBounds && c.boundingBox && !IntersectsBoundingBox(c.boundingBox, clipBounds)) continue;
                this._collectSubtree(c, clipBounds, priority, out);
            }
        }
    }

    // ───────── octree mutation handling ─────────

    private _onOctreeChanged(): void {
        for (const [viewId, ctx] of this._views) {
            if (ctx.camera) this._refresh(viewId, ctx);
        }
    }
}

// Re-export for callers that only pull StreamingEngine + want the context type.
export { IStreamActiveEntry, StreamActiveContext };
