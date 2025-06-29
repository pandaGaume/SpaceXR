import { BoundedCollection, IBounded, IBounds, IsBounds } from "../geometry";
import { Nullable } from "../types";
import { SpatialTree } from "./tree.spatial";
import { ISpatialTreeOptions, ISpatialTreeNode, ISpatialTreeContext } from "./tree.spatial.interfaces";

export class SpatialTreeNode<T extends IBounds | IBounded> implements ISpatialTreeNode<T> {
    boundingBox?: IBounds;
    depth: number;
    items?: BoundedCollection<T>;
    children?: Array<ISpatialTreeNode<T>>;

    public constructor(bounds?: IBounds, depth?: number) {
        this.boundingBox = bounds;
        this.depth = depth ?? 1;
    }

    public get isLeaf(): boolean {
        return (this.children?.length ?? 0) != 0;
    }

    public *[Symbol.iterator](predicate?: (n: Nullable<ISpatialTreeNode<T>>) => boolean): IterableIterator<Nullable<ISpatialTreeNode<T>>> {
        if (this.children) {
            if (predicate) {
                for (const t of this.children) {
                    if (predicate(t)) {
                        yield t;
                    }
                }
            }
            return this.children;
        }
        return null;
    }

    public subdivide(options: ISpatialTreeOptions<T>) {
        if (options.spliter != undefined) {
            const splitBounds = options.spliter.split(this, options);
            if (splitBounds && splitBounds.length > 0) {
                const d = this.depth + 1;
                this.children = splitBounds.map((b) => this.createInstance(options, b, d));
            }
            return;
        }
    }

    public lookupToRef(context: ISpatialTreeContext<T>, bounds: IBounds | IBounded, ref: T[]): void {
        const nodeBox = this.boundingBox;
        const lookupBox = IsBounds(bounds) ? bounds : bounds.boundingBox;
        if (lookupBox == undefined || lookupBox.intersects(nodeBox) == false) {
            return;
        }
        if (this.items) {
            // extract the data to ref
            // the bounds may be inside the node, but the items may be located into a small portion of it
            // so we may check for the items box.
            // this is not optimal when there is a small number of items so we may find a threshold
            // to do this check.
            const threshold = context.tree.lookupThreshold ?? SpatialTree.DefaultLookupThreshold;
            if (this.items.length < threshold) {
                const contentBounds = this.items.boundingBox;
                if (lookupBox.intersects(contentBounds) == false) {
                    return;
                }
            }
            for (const v of this.items.data) {
                const dataBox = IsBounds(v) ? v : v.boundingBox;
                if (dataBox && dataBox.intersects(lookupBox)) {
                    ref.push(v);
                }
            }
            return;
        }
        if (this.children) {
            for (const c of this.children) {
                c.lookupToRef(context, bounds, ref);
            }
        }
    }

    protected _checkBounds(data: T[]): T[] {
        const nodeBox = this.boundingBox;
        const accepted: T[] = [];
        const indicesToRemove: number[] = [];

        for (let i = 0; i < data.length; i++) {
            const v = data[i];
            const dataBox = IsBounds(v) ? v : v.boundingBox;
            if (dataBox?.intersects(nodeBox)) {
                accepted.push(v);
                indicesToRemove.push(i);
            }
        }

        // Bulk remove by filtering
        for (let i = indicesToRemove.length - 1; i >= 0; i--) {
            data.splice(indicesToRemove[i], 1);
        }

        return accepted;
    }
    public createInstance(ctx: ISpatialTreeOptions<T>, box: IBounds, depth: number): ISpatialTreeNode<T> {
        const ctor = this.constructor as { new (bounds?: IBounds, depth?: number): ISpatialTreeNode<T> };
        return new ctor();
    }

    public add(context: ISpatialTreeContext<T>, data: T[]): void {
        const accepted = this._checkBounds(data);
        if (accepted.length == 0) {
            return;
        }

        if (this.children?.length) {
            // send the data to childrens
            for (const c of this.children) {
                c.add(context, accepted);
                if (accepted.length == 0) {
                    break;
                }
            }
            return;
        }

        // we do not have children
        // the first reason is we reach the bottom
        if (this.depth == context.tree.maxDepth) {
            // the only way is to fill the items
            this.items = this.items ?? new BoundedCollection<T>();
            this.items.push(...accepted);
            return;
        }

        // do we have enought place to store the data ??
        if (this.items && this.items.length + accepted.length > context.tree.maxItemPerNode) {
            this.subdivide(context.tree);
            accepted.push(...this.items.data);
            this.items = undefined;
            if (this.children) {
                for (const c of this.children) {
                    c.add(context, accepted);
                    if (data.length == 0) {
                        break;
                    }
                }
            }
        }
    }

    public remove(context: ISpatialTreeContext<T>, data: T[]): void {
        const accepted = this._checkBounds(data);
        if (accepted.length == 0) {
            return;
        }
        if (this.items) {
            const removeSet = new Set(accepted);
            const kept = this.items.data.filter((item) => !removeSet.has(item));
            if (kept.length !== this.items.data.length) {
                this.items.data = kept;
            }
        }

        if (this.children) {
            for (const c of this.children) {
                c.remove(context, accepted);
            }
        }
    }
}
