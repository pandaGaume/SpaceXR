import { Stack } from "../collections";
import { IBounded, IBounds } from "../geometry";
import { ISpatialTree, ISpatialTreeContext, ISpatialTreeNode, SubdivisionScheme } from "./tree.spatial.interfaces";
import { SpatialTreeNode } from "./tree.spatial.node";

export class SpatialTree<T extends IBounds | IBounded> implements ISpatialTree<T> {
    public static DefaultMaxDepth = 32;
    public static DefaultMaxItemPerNode = 32;
    public static DefaultSubdivision = SubdivisionScheme.QUADTREE;

    protected _root: ISpatialTreeNode<T>;
    protected _subdivision: SubdivisionScheme;
    protected _maxDepth: number;
    protected _maxItemPerNode: number;

    public constructor(maxDepth: number = SpatialTree.DefaultMaxDepth, maxItemPerNode = SpatialTree.DefaultMaxItemPerNode, subdivision = SpatialTree.DefaultSubdivision) {
        this._subdivision = subdivision;
        this._maxDepth = maxDepth;
        this._maxItemPerNode = maxItemPerNode;
        this._root = new SpatialTreeNode<T>();
    }

    public get root(): ISpatialTreeNode<T> {
        return this._root;
    }

    public get subdivision(): SubdivisionScheme {
        return this._subdivision;
    }

    public get maxDepth(): number {
        return this._maxDepth;
    }

    public get maxItemPerNode(): number {
        return this._maxItemPerNode;
    }

    public get factory(): (a?: IBounds, b?: number) => ISpatialTreeNode<T> {
        return this._buildNode;
    }

    public add(...data: T[]): void {
        this._root.add(this._buildContext(), Array.from(data));
    }

    public remove(...data: T[]): void {
        this._root.remove(this._buildContext(), Array.from(data));
    }

    public lookupToRef(bounds: IBounds | IBounded, ref: T[]): void {
        this._root.lookupToRef(bounds, ref);
    }

    protected _buildNode(bounds?: IBounds, depth?: number): ISpatialTreeNode<T> {
        return new SpatialTreeNode<T>(bounds, depth);
    }
    protected _buildContext(): ISpatialTreeContext<T> {
        return { tree: this, stack: new Stack<ISpatialTreeNode<T>>(this._root) };
    }
}
