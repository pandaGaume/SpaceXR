import { ICartesian, ICartesian2, ICartesian3 } from "./geometry.interfaces";
import { ISpatialIndex, ISpatialIndexOptions } from "./geometry.spatial.interfaces";

const DEFAULT_MAX_DEPTH = 16;
const DEFAULT_MAX_ITEMS_PER_NODE = 32;

/**
 * Extract a coordinate from an ICartesian by axis index.
 * 0 = x, 1 = y, 2 = z.
 */
function _getCoord(p: ICartesian, axis: number): number {
    switch (axis) {
        case 0:
            return (p as ICartesian2).x;
        case 1:
            return (p as ICartesian2).y;
        case 2:
            return (p as ICartesian3).z;
        default:
            return 0;
    }
}

/**
 * Minimum squared distance from a point to an axis-aligned cell.
 * Returns 0 if the point is inside the cell.
 * Used to prune entire branches during radius queries.
 */
function _cellDistanceSquared(center: number[], halfSize: number[], point: ICartesian, dim: number): number {
    let distSq = 0;
    for (let i = 0; i < dim; i++) {
        const v = _getCoord(point, i);
        const lo = center[i] - halfSize[i];
        const hi = center[i] + halfSize[i];
        if (v < lo) {
            const d = lo - v;
            distSq += d * d;
        } else if (v > hi) {
            const d = v - hi;
            distSq += d * d;
        }
    }
    return distSq;
}

/**
 * Internal tree node. Either a leaf (items != null) or an inner node (children != null).
 * Center + halfSize define the axis-aligned cell bounds without an IBounds dependency.
 */
class SpatialNode<T extends ICartesian> {
    items: T[] | null = [];
    children: SpatialNode<T>[] | null = null;

    constructor(
        /** Cell center coordinates, length = dimension. */
        public center: number[],
        /** Half-extent per axis, length = dimension. */
        public halfSize: number[],
        /** Depth in the tree (0 = root). */
        public depth: number
    ) {}
}

/**
 * Point-based spatial tree implementing quadtree (2D) and octree (3D).
 *
 * Designed for neuron position queries: items are points (ICartesian),
 * not bounding volumes. All distance comparisons use squared distances
 * to avoid sqrt overhead.
 *
 * Subdivision: when a leaf exceeds maxItemsPerNode, it splits into
 * 4 children (2D) or 8 children (3D) by bisecting each axis at the cell center.
 *
 * Child index mapping uses bit encoding: bit 0 = x >= center, bit 1 = y >= center,
 * bit 2 = z >= center (3D only).
 *
 * @typeParam T - Point type extending ICartesian
 */
export class PointSpatialTree<T extends ICartesian> implements ISpatialIndex<T> {
    private _root: SpatialNode<T>;
    private _size: number = 0;
    private _maxDepth: number;
    private _maxItems: number;
    private _dim: 2 | 3;

    public get size(): number {
        return this._size;
    }
    public get dimension(): 2 | 3 {
        return this._dim;
    }

    /**
     * @param options - Tree configuration (dimension, depth, capacity).
     * @param center - Root cell center. Defaults to origin.
     * @param halfSize - Root cell half-extent per axis. Defaults to 1e6 (effectively unbounded).
     */
    constructor(options: ISpatialIndexOptions, center?: number[], halfSize?: number[]) {
        this._dim = options.dimension;
        this._maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
        this._maxItems = options.maxItemsPerNode ?? DEFAULT_MAX_ITEMS_PER_NODE;

        const d = this._dim;
        const c = center ?? new Array(d).fill(0);
        const h = halfSize ?? new Array(d).fill(1e6);
        this._root = new SpatialNode<T>(c, h, 0);
    }

    public add(item: T): void {
        this._insert(this._root, item);
        this._size++;
    }

    public remove(item: T): boolean {
        if (this._remove(this._root, item)) {
            this._size--;
            return true;
        }
        return false;
    }

    public queryRadius(center: ICartesian, radius: number, ref: T[]): void {
        const rSq = radius * radius;
        this._queryRadius(this._root, center, rSq, ref);
    }

    public kNearest(center: ICartesian, k: number, ref: T[]): void {
        if (k <= 0 || this._size === 0) return;

        // Collect all points then sort by distance.
        // For large trees a bounded priority queue would be more efficient,
        // but this is correct and simple for the initial implementation.
        const candidates: T[] = [];
        this._collectAll(this._root, center, candidates);

        candidates.sort((a, b) => center.distanceSquared(a) - center.distanceSquared(b));

        const n = Math.min(k, candidates.length);
        for (let i = 0; i < n; i++) {
            ref.push(candidates[i]);
        }
    }

    public clear(): void {
        const d = this._dim;
        this._root = new SpatialNode<T>(new Array(d).fill(0), new Array(d).fill(1e6), 0);
        this._size = 0;
    }

    /** Navigate to the correct leaf and insert. Triggers subdivision if capacity exceeded. */
    private _insert(node: SpatialNode<T>, item: T): void {
        if (node.children) {
            const idx = this._childIndex(node, item);
            this._insert(node.children[idx], item);
            return;
        }

        node.items!.push(item);

        if (node.items!.length > this._maxItems && node.depth < this._maxDepth) {
            this._subdivide(node);
        }
    }

    /**
     * Split a leaf into 4 (2D) or 8 (3D) children by bisecting each axis.
     * Existing items are redistributed to the appropriate child.
     */
    private _subdivide(node: SpatialNode<T>): void {
        const dim = this._dim;
        const count = dim === 2 ? 4 : 8;
        node.children = new Array(count);

        for (let i = 0; i < count; i++) {
            const newCenter = new Array(dim);
            const newHalf = new Array(dim);
            for (let a = 0; a < dim; a++) {
                newHalf[a] = node.halfSize[a] * 0.5;
                // Bit a of child index i determines +/- offset on axis a
                newCenter[a] = node.center[a] + ((i >> a) & 1 ? newHalf[a] : -newHalf[a]);
            }
            node.children[i] = new SpatialNode<T>(newCenter, newHalf, node.depth + 1);
        }

        const items = node.items!;
        node.items = null;
        for (const item of items) {
            const idx = this._childIndex(node, item);
            node.children[idx].items!.push(item);
        }
    }

    /** Map a point to its child index using bit encoding per axis. */
    private _childIndex(node: SpatialNode<T>, item: ICartesian): number {
        let idx = 0;
        for (let a = 0; a < this._dim; a++) {
            if (_getCoord(item, a) >= node.center[a]) {
                idx |= 1 << a;
            }
        }
        return idx;
    }

    /** Remove by reference equality. Navigates to the correct leaf. */
    private _remove(node: SpatialNode<T>, item: T): boolean {
        if (node.children) {
            const idx = this._childIndex(node, item);
            return this._remove(node.children[idx], item);
        }

        if (!node.items) return false;
        const i = node.items.indexOf(item);
        if (i === -1) return false;

        node.items.splice(i, 1);
        return true;
    }

    /**
     * Recursive radius query. Prunes branches whose cell is entirely
     * outside the search sphere (cellDistanceSquared > rSq).
     */
    private _queryRadius(node: SpatialNode<T>, center: ICartesian, rSq: number, ref: T[]): void {
        if (_cellDistanceSquared(node.center, node.halfSize, center, this._dim) > rSq) {
            return;
        }

        if (node.items) {
            for (const item of node.items) {
                if (center.distanceSquared(item) <= rSq) {
                    ref.push(item);
                }
            }
            return;
        }

        if (node.children) {
            for (const child of node.children) {
                this._queryRadius(child, center, rSq, ref);
            }
        }
    }

    /** Collect all items in the subtree (used by kNearest). */
    private _collectAll(node: SpatialNode<T>, center: ICartesian, ref: T[]): void {
        if (node.items) {
            for (const item of node.items) {
                ref.push(item);
            }
            return;
        }

        if (node.children) {
            for (const child of node.children) {
                this._collectAll(child, center, ref);
            }
        }
    }
}
