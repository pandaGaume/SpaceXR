import { IBounded, IBounds } from "../../geometry";
import { SpatialTreeNode } from "../../tree/tree.spatial.node";
import { ITile3DNode, RefinementStrategy } from "./tile3d.interfaces";

export class Tile3DNode<T extends IBounds | IBounded> extends SpatialTreeNode<T> implements ITile3DNode<T> {
    protected _refinementStrategy: RefinementStrategy;
    protected _geometricError: number;

    public constructor(bounds?: IBounds, depth?: number, error: number = 0) {
        super(bounds, depth);
        this._refinementStrategy = RefinementStrategy.REPLACEMENT;
        this._geometricError = error;
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
}
