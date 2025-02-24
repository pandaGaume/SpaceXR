import { Nullable } from "core/types";
import { ITile3DNode, RefinementStrategy } from "./tile3d.interfaces";
import { Bounds, IBounds } from "core/geometry";
import { SubdivisionScheme } from "core/tree/tree.spatial.interfaces";

export class Tile3DNode implements ITile3DNode {
    public static Split(
        node: Tile3DNode,
        sub: SubdivisionScheme,
        refinement?: RefinementStrategy,
        constructor?: new (bounds?: IBounds, error?: number) => ITile3DNode,
        error?: (e: number) => number
    ): Array<ITile3DNode> {
        if (node.boundingBox) {
            const buildChild = (bounds: IBounds, error: number): ITile3DNode => {
                const n = constructor ? new constructor(bounds, error) : new Tile3DNode(bounds);
                if (n) {
                    n.refinementStrategy = refinement ?? node.refinementStrategy;
                }
                return n;
            };
            const { xmin, ymin, zmin, width, height, depth } = node.boundingBox;
            const halfWidth = width / 2;
            const halfHeight = height / 2;
            const halfDepth = depth / 2;
            const midX = xmin + halfWidth;
            const midY = ymin + halfHeight;
            const midZ = zmin + halfDepth;
            const d = error ? error(node.geometricError) : node.geometricError / 2;

            switch (sub) {
                case SubdivisionScheme.QUADTREE: {
                    return [
                        buildChild(new Bounds(xmin, ymin, halfWidth, halfHeight, zmin, 0), d), // Bottom-left
                        buildChild(new Bounds(xmin, midY, halfWidth, halfHeight, zmin, 0), d), // Top-left
                        buildChild(new Bounds(midX, ymin, halfWidth, halfHeight, zmin, 0), d), // Bottom-right
                        buildChild(new Bounds(midX, midY, halfWidth, halfHeight, zmin, 0), d), // Top-right
                    ];
                }
                case SubdivisionScheme.OCTREE: {
                    return [
                        buildChild(new Bounds(xmin, ymin, halfWidth, halfHeight, zmin, halfDepth), d), // Bottom-left-front
                        buildChild(new Bounds(xmin, midY, halfWidth, halfHeight, zmin, halfDepth), d), // Top-left-front
                        buildChild(new Bounds(midX, ymin, halfWidth, halfHeight, zmin, halfDepth), d), // Bottom-right-front
                        buildChild(new Bounds(midX, midY, halfWidth, halfHeight, zmin, halfDepth), d), // Top-right-front
                        buildChild(new Bounds(xmin, ymin, halfWidth, halfHeight, midZ, halfDepth), d), // Bottom-left-back
                        buildChild(new Bounds(xmin, midY, halfWidth, halfHeight, midZ, halfDepth), d), // Top-left-back
                        buildChild(new Bounds(midX, ymin, halfWidth, halfHeight, midZ, halfDepth), d), // Bottom-right-back
                        buildChild(new Bounds(midX, midY, halfWidth, halfHeight, midZ, halfDepth), d), // Top-right-back
                    ];
                }
            }
        }
        return [];
    }

    protected _refinementStrategy: RefinementStrategy;
    protected _geometricError: number;
    protected _children?: Array<ITile3DNode>;
    protected _bounds?: IBounds;

    public constructor(bounds?: IBounds, error: number = 0) {
        this._refinementStrategy = RefinementStrategy.REPLACEMENT;
        this._geometricError = error;
        this._bounds = bounds;
    }

    public get isLeaf(): boolean {
        return (this.children?.length ?? 0) != 0;
    }

    public get children(): Array<ITile3DNode> | undefined {
        return this._children;
    }

    public get boundingBox(): IBounds | undefined {
        return this._bounds;
    }

    public get refinementStrategy(): RefinementStrategy {
        return RefinementStrategy.ADDITIVE;
    }

    public set refinementStrategy(v: RefinementStrategy) {
        if (v !== this._refinementStrategy) {
            this._refinementStrategy = v;
        }
    }

    public get geometricError(): number {
        return this._geometricError;
    }

    public set geometricError(v: number) {
        if (v !== this._geometricError) {
            this._geometricError = v;
        }
    }

    public *[Symbol.iterator](predicate?: (n: Nullable<ITile3DNode>) => boolean): IterableIterator<Nullable<ITile3DNode>> {
        if (this._children) {
            if (predicate) {
                for (const t of this._children) {
                    if (predicate(t)) {
                        yield t;
                    }
                }
            }
            return this._children;
        }
        return null;
    }

    public split(sub: SubdivisionScheme = SubdivisionScheme.QUADTREE, refinementStrategy?: RefinementStrategy): void {
        this._children = Tile3DNode.Split(this, sub, refinementStrategy ?? this.refinementStrategy, this._constructor() ?? Tile3DNode);
    }

    protected _constructor(): new (bounds?: IBounds, error?: number) => ITile3DNode {
        return Tile3DNode;
    }
}
