import { ITileAddress } from "./tiles.interfaces";
import { TileMetrics } from "./tiles.metrics";

export class TileAddress implements ITileAddress {
    private _k?: string;

    public constructor(public x: number, public y: number, public levelOfDetail: number) {}
    public get quadkey(): string | undefined {
        if (!this._k) {
            this._k = TileMetrics.TileXYToQuadKey(this);
        }
        return this._k;
    }
}
