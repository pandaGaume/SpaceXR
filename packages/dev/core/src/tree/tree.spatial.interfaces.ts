import { BoundedCollection, IBounded, IBounds } from "../geometry";
import { Nullable } from "../types";

export interface ISplitter<T extends IBounds | IBounded> {
    split: (node: ISpatialTreeNode<T>, options: ISpatialTreeOptions<T>) => Array<IBounds>;
}

export interface IKdtreeSplitter<T extends IBounds | IBounded> extends ISplitter<T> {
    splitAxisSelector?: (depth: number, dimension: number) => number;
    dimension?: number;
}

export function IsKDTreeSplitter<T extends IBounds | IBounded>(splitter: ISplitter<T>): splitter is IKdtreeSplitter<T> {
    return (splitter as IKdtreeSplitter<T>).splitAxisSelector !== undefined;
}

export interface ISpatialTreeOptions<T extends IBounds | IBounded> {
    maxDepth: number;
    maxItemPerNode: number;
    factory: (a?: IBounds, b?: number) => ISpatialTreeNode<T>;
    spliter: ISplitter<T>;
    lookupThreshold?: number;
}

// Round-robin for ND
export function RoundRobin(depth: number, dimension: number) {
    return depth % dimension;
}

export interface ISpatialTreeContext<T extends IBounds | IBounded> {
    tree: ISpatialTree<T>;
    lookupThreshold?: number;
}

export interface ISpatialTreeNode<T extends IBounds | IBounded> extends IBounded {
    depth: number;
    items?: BoundedCollection<T>;
    children?: Array<ISpatialTreeNode<T>>;
    [Symbol.iterator](predicate?: (n: Nullable<ISpatialTreeNode<T>>) => boolean): IterableIterator<Nullable<ISpatialTreeNode<T>>>;
    isLeaf: boolean;

    add(context: ISpatialTreeContext<T>, data: T[]): void;
    remove(context: ISpatialTreeContext<T>, data: T[]): void;
    lookupToRef(context: ISpatialTreeContext<T>, bounds: IBounds | IBounded, ref: T[]): void;
}

export interface ISpatialTree<T extends IBounds | IBounded> extends ISpatialTreeOptions<T>, IBounded {
    root: ISpatialTreeNode<T>;

    add(...data: Array<T>): void;
    remove(...data: Array<T>): void;
    lookupToRef(bounds: IBounds | IBounded, ref: Array<T>): void;
}
