import { IStack } from "../collections";
import { BoundedCollection, IBounded, IBounds } from "../geometry";

export enum SubdivisionScheme {
    QUADTREE,
    OCTREE,
}

export interface ISpatialTreeOptions<T extends IBounds | IBounded> {
    maxDepth: number;
    maxItemPerNode: number;
    subdivision: SubdivisionScheme;
    factory: (a?: IBounds, b?: number) => ISpatialTreeNode<T>;
}

export interface ISpatialTreeContext<T extends IBounds | IBounded> {
    tree: ISpatialTree<T>;
    stack: IStack<ISpatialTreeNode<T>>;
}

export interface ISpatialTreeNode<T extends IBounds | IBounded> extends IBounded {
    depth: number;
    items?: BoundedCollection<T>;
    children?: Array<ISpatialTreeNode<T>>;

    add(context: ISpatialTreeContext<T>, data: T[]): void;
    remove(context: ISpatialTreeContext<T>, data: T[]): void;
    lookupToRef(bounds: IBounds | IBounded, ref: T[]): void;
}

export interface ISpatialTree<T extends IBounds | IBounded> extends ISpatialTreeOptions<T>, IBounded {
    root: ISpatialTreeNode<T>;

    add(...data: Array<T>): void;
    remove(...data: Array<T>): void;
    lookupToRef(bounds: IBounds | IBounded, ref: Array<T>): void;
}
