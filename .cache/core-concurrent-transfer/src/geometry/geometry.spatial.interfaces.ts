import { ICartesian } from "./geometry.interfaces";

/**
 * Configuration for spatial index construction.
 */
export interface ISpatialIndexOptions {
    /** Maximum subdivision depth. Deeper = finer cells but more memory. Default 16. */
    maxDepth?: number;
    /** Maximum items per leaf before subdivision. Default 32. */
    maxItemsPerNode?: number;
    /** Spatial dimension: 2 for quadtree, 3 for octree. */
    dimension: 2 | 3;
}

/**
 * Point-based spatial index for efficient proximity queries.
 *
 * Items are stored as points (ICartesian), not bounding volumes.
 * All queries use squared-distance comparisons internally (no sqrt).
 *
 * Output uses the `ref` pattern: results are pushed into a caller-provided
 * array to avoid per-query allocation.
 *
 * @typeParam T - Any type extending ICartesian (e.g. ICartesian2, ICartesian3, INode with position)
 */
export interface ISpatialIndex<T extends ICartesian> {
    /** Number of items currently indexed. */
    readonly size: number;
    /** Spatial dimension (2 = quadtree, 3 = octree). */
    readonly dimension: 2 | 3;
    /** Insert an item into the index. */
    add(item: T): void;
    /** Remove an item by reference equality. Returns true if found and removed. */
    remove(item: T): boolean;
    /** Find all items within `radius` euclidean distance of `center`. Results pushed to `ref`. */
    queryRadius(center: ICartesian, radius: number, ref: T[]): void;
    /** Find the `k` closest items to `center`, sorted by distance. Results pushed to `ref`. */
    kNearest(center: ICartesian, k: number, ref: T[]): void;
    /** Remove all items and reset the tree. */
    clear(): void;
}
