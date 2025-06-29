import { IBounded, IBounds } from "../geometry";
import { ISpatialTree, ISpatialTreeContext, ISpatialTreeNode, ISplitter } from "./tree.spatial.interfaces";
import { SpatialTreeNode } from "./tree.spatial.node";
import { QuadtreeSplitter } from "./tree.spatial.splitters";

export class SpatialTree<T extends IBounds | IBounded> implements ISpatialTree<T> {
    public static DefaultMaxDepth = 32;
    public static DefaultMaxItemPerNode = 32;
    public static DefaultLookupThreshold = 512;

    protected _root: ISpatialTreeNode<T>;
    protected _maxDepth: number;
    protected _maxItemPerNode: number;
    protected _lookupThresold: number;
    protected _splitter: ISplitter<T>;

    private _context: ISpatialTreeContext<T>;

    public constructor(
        maxDepth: number = SpatialTree.DefaultMaxDepth,
        maxItemPerNode = SpatialTree.DefaultMaxItemPerNode,
        subdivision = new QuadtreeSplitter<T>(),
        lookupThreshold = SpatialTree.DefaultLookupThreshold
    ) {
        this._splitter = subdivision;
        this._maxDepth = maxDepth;
        this._maxItemPerNode = maxItemPerNode;
        this._lookupThresold = lookupThreshold;
        this._root = new SpatialTreeNode<T>();
        this._context = this._buildContext();
    }

    public get root(): ISpatialTreeNode<T> {
        return this._root;
    }

    public get spliter(): ISplitter<T> {
        return this._splitter;
    }

    public get maxDepth(): number {
        return this._maxDepth;
    }

    public get maxItemPerNode(): number {
        return this._maxItemPerNode;
    }

    public get lookupThreshold(): number {
        return this._lookupThresold;
    }

    public get factory(): (a?: IBounds, b?: number) => ISpatialTreeNode<T> {
        return this._buildNode;
    }

    public add(...data: T[]): void {
        this._root.add(this._context, Array.from(data));
    }

    public remove(...data: T[]): void {
        this._root.remove(this._context, Array.from(data));
    }

    public lookupToRef(bounds: IBounds | IBounded, ref: T[]): void {
        this._root.lookupToRef(this._context, bounds, ref);
    }

    protected _buildNode(bounds?: IBounds, depth?: number): ISpatialTreeNode<T> {
        return new SpatialTreeNode<T>(bounds, depth);
    }

    protected _buildContext(): ISpatialTreeContext<T> {
        return { tree: this, lookupThreshold: this._lookupThresold };
    }
}
