import { ICameraViewState } from "../camera";
import { Observer } from "../events";
import { SourceBlock } from "../tiles/pipeline/tiles.pipeline.sourceblock";
import { IDisposable, Nullable } from "../types";
import { IObservableOctree, IOctreeNode, IVisibilityPolicy } from "../tree/tree.octree.interfaces";
import { IStreamSource, IStreamSourceActivation } from "./streaming.datasource.interfaces";
import { ScreenSpaceErrorPolicy } from "./streaming.visibility.sse";

export interface IStreamingEngineOptions {
    /** Stable identifier for this view. Propagated in emitted activations. */
    viewId: string;
    /** Per-view camera state. The engine subscribes to its propertyChangedObservable if present. */
    camera: ICameraViewState;
    /** One or more shared octrees. Item activations are accumulated across them. */
    octrees: ReadonlyArray<IObservableOctree<IStreamSource>>;
    /** Fallback visibility policy for cells that do not define one. */
    defaultPolicy?: IVisibilityPolicy<IStreamSource>;
    /**
     * When true (default), the engine runs a refresh on every octree event
     * (added / removed / updated) and on every camera property change.
     * Set to false to drive refreshes manually (e.g. on a render tick).
     */
    autoRefresh?: boolean;
}

/**
 * Per-camera engine that traverses shared octrees, applies visibility policies,
 * diffs against the previous active set, and emits datasource activations
 * through the SourceBlock pipeline pattern.
 *
 * Emission model:
 *  - addedObservable: datasources newly activated (operation: activate)
 *  - removedObservable: datasources newly deactivated (operation: deactivate)
 *  - updatedObservable: active datasources whose bounds changed (operation: update)
 *
 * The engine holds a Set of currently-visible cells and a Map of active sources,
 * which lets it react incrementally to octree mutations (fleet-monitoring case).
 */
export class StreamingEngine extends SourceBlock<IStreamSourceActivation> implements IDisposable {
    private readonly _viewId: string;
    private readonly _camera: ICameraViewState;
    private readonly _octrees: ReadonlyArray<IObservableOctree<IStreamSource>>;
    private readonly _defaultPolicy: IVisibilityPolicy<IStreamSource>;
    private readonly _autoRefresh: boolean;

    private _visibleCells: Set<IOctreeNode<IStreamSource>> = new Set();
    private _refineCells: Set<IOctreeNode<IStreamSource>> = new Set();
    private _active: Map<string, IStreamSource> = new Map();

    private _cameraObserver: Nullable<Observer<unknown>> = null;
    private _octreeObservers: Array<Observer<any>> = [];

    public constructor(options: IStreamingEngineOptions) {
        super();
        this._viewId = options.viewId;
        this._camera = options.camera;
        this._octrees = options.octrees;
        this._defaultPolicy = options.defaultPolicy ?? new ScreenSpaceErrorPolicy<IStreamSource>();
        this._autoRefresh = options.autoRefresh ?? true;

        if (this._autoRefresh) {
            this._subscribeAll();
        }
    }

    public get viewId(): string {
        return this._viewId;
    }

    public get visibleCells(): ReadonlySet<IOctreeNode<IStreamSource>> {
        return this._visibleCells;
    }

    public get activeSources(): ReadonlyMap<string, IStreamSource> {
        return this._active;
    }

    /**
     * Runs a traversal, diffs against the current state and emits activations.
     *
     * By default the traversal is incremental: it starts from the parents of last
     * frame's frontier (_refineCells ∪ _visibleCells), dedup'd via a visited set.
     * This avoids re-walking the whole tree when the camera moves slightly.
     *
     * Pass `clearCache = true` to force a full traversal from the tree roots
     * (camera teleport, octree swap, fresh world, etc.).
     *
     * Diff semantics:
     *   - invisible → visible : emit "activate"
     *   - visible   → invisible : emit "deactivate"
     * The engine is the visibility authority. It does not broadcast bounds changes
     * of active items: the scene already holds the IStreamSource reference and can
     * observe its bounds directly if needed.
     */
    public refresh(clearCache: boolean = false): void {
        if (clearCache) {
            this._refineCells.clear();
            this._visibleCells.clear();
        }

        const nextRefine = new Set<IOctreeNode<IStreamSource>>();
        const nextCells = new Set<IOctreeNode<IStreamSource>>();
        const nextItems = new Map<string, IStreamSource>();
        const visited = new Set<IOctreeNode<IStreamSource>>();

        const startCells = this._computeStartCells();
        for (const start of startCells) {
            this._traverse(start, visited, nextRefine, nextCells, nextItems);
        }

        const added: IStreamSourceActivation[] = [];
        const removed: IStreamSourceActivation[] = [];

        for (const [id, src] of nextItems) {
            if (!this._active.has(id)) {
                added.push({ source: src, operation: "activate", priority: 0, viewId: this._viewId });
            }
        }
        for (const [id, src] of this._active) {
            if (!nextItems.has(id)) {
                removed.push({ source: src, operation: "deactivate", priority: 0, viewId: this._viewId });
            }
        }

        this._refineCells = nextRefine;
        this._visibleCells = nextCells;
        this._active = nextItems;

        if (added.length > 0) this.notifyAdded(added);
        if (removed.length > 0) this.notifyRemoved(removed);
    }

    /**
     * Forces the next refresh to traverse from the roots. Use after camera teleports
     * or any event that invalidates the incremental state. Equivalent to `refresh(true)`
     * when called before `refresh()`.
     */
    public resetTraversalCache(): void {
        this._refineCells.clear();
        this._visibleCells.clear();
    }

    public override dispose(): void {
        this._unsubscribeAll();
        super.dispose();
    }

    private _traverse(
        node: IOctreeNode<IStreamSource>,
        visited: Set<IOctreeNode<IStreamSource>>,
        refineOut: Set<IOctreeNode<IStreamSource>>,
        cellsOut: Set<IOctreeNode<IStreamSource>>,
        itemsOut: Map<string, IStreamSource>
    ): void {
        if (visited.has(node)) return;
        visited.add(node);

        const policy = node.resolveVisibilityPolicy?.() ?? this._defaultPolicy;
        const decision = policy.evaluate(node, this._camera);

        switch (decision.kind) {
            case "cull":
                return;
            case "load":
                cellsOut.add(node);
                this._collectSubtree(node, itemsOut);
                return;
            case "refine":
                if (node.children && node.children.length > 0) {
                    refineOut.add(node);
                    for (const c of node.children) {
                        this._traverse(c, visited, refineOut, cellsOut, itemsOut);
                    }
                } else {
                    cellsOut.add(node);
                    this._collectSubtree(node, itemsOut);
                }
                return;
        }
    }

    /**
     * Returns the nodes from which the traversal should descend on this frame.
     *
     * - Cold start (no prior frontier): the roots of every octree.
     * - Warm start: parents of every cell in the prior frontier. Walking up one
     *   level catches siblings that transition from cull to load/refine when the
     *   camera moves slightly. The `visited` set in `_traverse` handles the overlap.
     *
     * For a camera jump that moves past that one-level neighborhood, call
     * `refresh(true)` or `resetTraversalCache()` to force a full re-traversal.
     */
    private _computeStartCells(): Array<IOctreeNode<IStreamSource>> {
        if (this._refineCells.size === 0 && this._visibleCells.size === 0) {
            return this._octrees.map((t) => t.root);
        }
        const starts = new Set<IOctreeNode<IStreamSource>>();
        const push = (cell: IOctreeNode<IStreamSource>) => {
            const anchor = (cell.parent as IOctreeNode<IStreamSource> | null | undefined) ?? cell;
            starts.add(anchor);
        };
        for (const cell of this._refineCells) push(cell);
        for (const cell of this._visibleCells) push(cell);
        return Array.from(starts);
    }

    private _collectSubtree(node: IOctreeNode<IStreamSource>, out: Map<string, IStreamSource>): void {
        if (node.items) {
            for (const item of node.items.data) {
                out.set(item.id, item);
            }
        }
        if (node.children) {
            for (const c of node.children) {
                this._collectSubtree(c, out);
            }
        }
    }

    private _subscribeAll(): void {
        if (this._camera.propertyChangedObservable) {
            const obs = this._camera.propertyChangedObservable.add(() => this.refresh());
            this._cameraObserver = obs as unknown as Observer<unknown>;
        }
        for (const tree of this._octrees) {
            const onAdded = tree.addedObservable.add(() => this.refresh());
            const onRemoved = tree.removedObservable.add(() => this.refresh());
            const onUpdated = tree.updatedObservable.add(() => this.refresh());
            if (onAdded) this._octreeObservers.push(onAdded);
            if (onRemoved) this._octreeObservers.push(onRemoved);
            if (onUpdated) this._octreeObservers.push(onUpdated);
        }
        this.refresh();
    }

    private _unsubscribeAll(): void {
        this._cameraObserver?.disconnect();
        this._cameraObserver = null;
        for (const o of this._octreeObservers) o.disconnect();
        this._octreeObservers = [];
    }
}
