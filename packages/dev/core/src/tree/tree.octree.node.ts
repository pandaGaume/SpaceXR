import { IBounded, IBounds } from "../geometry";
import { Nullable } from "../types";
import { ISpatialTreeOptions } from "./tree.spatial.interfaces";
import { SpatialTreeNode } from "./tree.spatial.node";
import { IOctreeNode, IReferenceFrame, IVisibilityPolicy } from "./tree.octree.interfaces";

export class OctreeNode<T extends IBounds | IBounded> extends SpatialTreeNode<T> implements IOctreeNode<T> {
    public referenceFrame?: IReferenceFrame;
    public geometricError?: number;
    public visibilityPolicy?: IVisibilityPolicy<T>;

    public parent?: Nullable<IOctreeNode<T>>;
    public override children?: Array<IOctreeNode<T>>;

    public constructor(bounds?: IBounds, depth?: number, parent?: Nullable<IOctreeNode<T>>) {
        super(bounds, depth);
        this.parent = parent ?? null;
    }

    public resolveReferenceFrame(): IReferenceFrame | undefined {
        let n: IOctreeNode<T> | undefined | null = this;
        while (n) {
            if (n.referenceFrame) return n.referenceFrame;
            n = n.parent ?? null;
        }
        return undefined;
    }

    public resolveVisibilityPolicy(): IVisibilityPolicy<T> | undefined {
        let n: IOctreeNode<T> | undefined | null = this;
        while (n) {
            if (n.visibilityPolicy) return n.visibilityPolicy;
            n = n.parent ?? null;
        }
        return undefined;
    }

    public override createInstance(_ctx: ISpatialTreeOptions<T>, box: IBounds, depth: number): OctreeNode<T> {
        const child = new OctreeNode<T>(box, depth, this);
        return child;
    }
}
