import { Nullable } from "core/types";
import { ITile3D, RefinementStrategy } from "./tile3d.interfaces";
import { IBounds } from "core/geometry";

export class Tile3D implements ITile3D {
    private _refinementStrategy: RefinementStrategy;
    private _geometricError: number;
    private _children?: Array<ITile3D>;
    private _bounds?: IBounds;

    public constructor() {
        this._refinementStrategy = RefinementStrategy.REPLACEMENT;
        this._geometricError = 0;
    }

    public get isLeaf(): boolean {
        return (this.children?.length ?? 0) != 0;
    }

    public get children(): Array<ITile3D> | undefined {
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

    public *[Symbol.iterator](predicate?: (n: Nullable<ITile3D>) => boolean): IterableIterator<Nullable<ITile3D>> {
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
}
