import { IBounded, IBounds, IsBounded } from "../geometry";
import { Observable } from "../events";
import { ISpatialTreeNode } from "./tree.spatial.interfaces";
import { SpatialTree } from "./tree.spatial";
import { OctreeSplitter } from "./tree.spatial.splitters";
import { OctreeNode } from "./tree.octree.node";
import { IObservableOctree, IOctreeNode, IOctreeUpdate, IReferenceFrame, IVisibilityPolicy } from "./tree.octree.interfaces";

export interface IOctreeRootOptions<T extends IBounds | IBounded> {
    /** Default reference frame inherited by any node that does not override it. */
    referenceFrame?: IReferenceFrame;
    /** Default visibility policy inherited by any node that does not override it. */
    visibilityPolicy?: IVisibilityPolicy<T>;
    /** Root geometric error. Children typically divide this by 2 but that is up to the caller. */
    geometricError?: number;
}

/**
 * Hierarchical spatial index with 8-way subdivision.
 *
 * In addition to the generic SpatialTree contract:
 *  - carries per-cell metadata (reference frame, geometric error, visibility policy)
 *    used by the streaming pipeline
 *  - is observable: add/remove/update emit events so downstream views can keep their
 *    visibility set coherent in fleet-monitoring scenarios where items move between cells
 *
 * Remains generic on T so the tree can also be used outside the streaming module.
 */
export class Octree<T extends IBounds | IBounded> extends SpatialTree<T> implements IObservableOctree<T> {
    private _added?: Observable<ReadonlyArray<T>>;
    private _removed?: Observable<ReadonlyArray<T>>;
    private _updated?: Observable<ReadonlyArray<IOctreeUpdate<T>>>;

    public constructor(
        maxDepth: number = SpatialTree.DefaultMaxDepth,
        maxItemPerNode: number = SpatialTree.DefaultMaxItemPerNode,
        lookupThreshold: number = SpatialTree.DefaultLookupThreshold,
        rootOptions?: IOctreeRootOptions<T>
    ) {
        super(maxDepth, maxItemPerNode, new OctreeSplitter<T>(), lookupThreshold);
        this._root = new OctreeNode<T>();
        if (rootOptions) {
            const root = this._root as OctreeNode<T>;
            root.referenceFrame = rootOptions.referenceFrame;
            root.visibilityPolicy = rootOptions.visibilityPolicy;
            root.geometricError = rootOptions.geometricError;
        }
    }

    public override get root(): IOctreeNode<T> {
        return this._root as IOctreeNode<T>;
    }

    public get addedObservable(): Observable<ReadonlyArray<T>> {
        this._added = this._added ?? new Observable<ReadonlyArray<T>>();
        return this._added;
    }

    public get removedObservable(): Observable<ReadonlyArray<T>> {
        this._removed = this._removed ?? new Observable<ReadonlyArray<T>>();
        return this._removed;
    }

    public get updatedObservable(): Observable<ReadonlyArray<IOctreeUpdate<T>>> {
        this._updated = this._updated ?? new Observable<ReadonlyArray<IOctreeUpdate<T>>>();
        return this._updated;
    }

    public override add(...data: T[]): void {
        if (data.length === 0) return;
        super.add(...data);
        if (this._added?.hasObservers()) {
            this._added.notifyObservers(data);
        }
    }

    public override remove(...data: T[]): void {
        if (data.length === 0) return;
        super.remove(...data);
        if (this._removed?.hasObservers()) {
            this._removed.notifyObservers(data);
        }
    }

    public update(item: T, previousBounds?: IBounds): void {
        this._rehome(item, previousBounds);
        if (this._updated?.hasObservers()) {
            this._updated.notifyObservers([{ item, previousBounds }]);
        }
    }

    public updateAll(updates: ReadonlyArray<IOctreeUpdate<T>>): void {
        if (updates.length === 0) return;
        for (const u of updates) {
            this._rehome(u.item, u.previousBounds);
        }
        if (this._updated?.hasObservers()) {
            this._updated.notifyObservers(updates);
        }
    }

    protected override _buildNode(bounds?: IBounds, depth?: number): ISpatialTreeNode<T> {
        return new OctreeNode<T>(bounds, depth);
    }

    /**
     * Moves an item within the tree. When previousBounds is provided and the item
     * is IBounded, we temporarily patch its boundingBox to previousBounds so the
     * remove walk follows the old path, then restore the new bounds for the add walk.
     * Without previousBounds, remove is attempted with the current (new) bounds: only
     * safe if the item has not yet left its former cell.
     */
    private _rehome(item: T, previousBounds?: IBounds): void {
        if (previousBounds && IsBounded(item)) {
            const current = item.boundingBox;
            item.boundingBox = previousBounds;
            super.remove(item);
            item.boundingBox = current;
            super.add(item);
            return;
        }
        super.remove(item);
        super.add(item);
    }
}
