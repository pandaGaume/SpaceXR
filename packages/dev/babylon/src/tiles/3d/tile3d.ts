import { Nullable, TransformNode, Node } from "@babylonjs/core";
import { IEnvelope } from "core/geography";
import { ITile3D, ITile3DGroup, RefinementStrategy } from "./tile3d.interfaces";

export class Tile3DGroup extends TransformNode implements ITile3DGroup {
    _envelope?: IEnvelope;

    public constructor(name: string) {
        super(name);
    }

    public get geoBounds(): IEnvelope | undefined {
        return this._envelope;
    }

    public set geoBounds(v: IEnvelope | undefined) {
        this._envelope = v;
    }

    public *[Symbol.iterator](predicate?: (n: Nullable<Node>) => boolean): IterableIterator<Nullable<Node>> {
        yield null;
    }
}

export class Tile3D extends TransformNode implements ITile3D {
    private _refinementStrategy: RefinementStrategy;
    private _geometricError: number;

    public constructor(name: string) {
        super(name);
        this._refinementStrategy = RefinementStrategy.REPLACEMENT;
        this._geometricError = 0;
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

    public *[Symbol.iterator](predicate?: (n: Nullable<Node>) => boolean): IterableIterator<Nullable<ITile3DGroup>> {
        return yield null;
    }
}
