import { BoundedCollection, Bounds, IBounded, IBounds, IsBounds } from "../geometry";
import { SpatialTree } from "./tree.spatial";
import { ISpatialTreeOptions, ISpatialTreeNode, SubdivisionScheme, ISpatialTreeContext } from "./tree.spatial.interfaces";

export class SpatialTreeNode<T extends IBounds | IBounded> implements ISpatialTreeNode<T> {
    boundingBox?: IBounds;
    depth: number;
    items?: BoundedCollection<T>;
    children?: Array<ISpatialTreeNode<T>>;

    constructor(bounds?: IBounds, depth?: number) {
        this.boundingBox = bounds;
        this.depth = depth ?? 1;
    }

    public subdivide(ctx: ISpatialTreeOptions<T>) {
        if (this.boundingBox) {
            const { xmin, ymin, zmin, width, height, depth } = this.boundingBox;
            const halfWidth = width / 2;
            const halfHeight = height / 2;
            const halfDepth = depth / 2;
            const midX = xmin + halfWidth;
            const midY = ymin + halfHeight;
            const midZ = zmin + halfDepth;
            const d = this.depth + 1;

            if (ctx.subdivision === SubdivisionScheme.QUADTREE) {
                this.children = [
                    this._buildChild(ctx, new Bounds(xmin, ymin, halfWidth, halfHeight, zmin, 0), d), // Bottom-left
                    this._buildChild(ctx, new Bounds(xmin, midY, halfWidth, halfHeight, zmin, 0), d), // Top-left
                    this._buildChild(ctx, new Bounds(midX, ymin, halfWidth, halfHeight, zmin, 0), d), // Bottom-right
                    this._buildChild(ctx, new Bounds(midX, midY, halfWidth, halfHeight, zmin, 0), d), // Top-right
                ];
            } else {
                this.children = [
                    this._buildChild(ctx, new Bounds(xmin, ymin, halfWidth, halfHeight, zmin, halfDepth), d), // Bottom-left-front
                    this._buildChild(ctx, new Bounds(xmin, midY, halfWidth, halfHeight, zmin, halfDepth), d), // Top-left-front
                    this._buildChild(ctx, new Bounds(midX, ymin, halfWidth, halfHeight, zmin, halfDepth), d), // Bottom-right-front
                    this._buildChild(ctx, new Bounds(midX, midY, halfWidth, halfHeight, zmin, halfDepth), d), // Top-right-front
                    this._buildChild(ctx, new Bounds(xmin, ymin, halfWidth, halfHeight, midZ, halfDepth), d), // Bottom-left-back
                    this._buildChild(ctx, new Bounds(xmin, midY, halfWidth, halfHeight, midZ, halfDepth), d), // Top-left-back
                    this._buildChild(ctx, new Bounds(midX, ymin, halfWidth, halfHeight, midZ, halfDepth), d), // Bottom-right-back
                    this._buildChild(ctx, new Bounds(midX, midY, halfWidth, halfHeight, midZ, halfDepth), d), // Top-right-back
                ];
            }
        }
    }

    protected _buildChild(ctx: ISpatialTreeOptions<T>, box: IBounds, depth: number): ISpatialTreeNode<T> {
        return ctx.factory(box, depth) ?? new SpatialTreeNode<T>(box, depth);
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

    private _checkBounds(data: T[]): T[] {
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
}
