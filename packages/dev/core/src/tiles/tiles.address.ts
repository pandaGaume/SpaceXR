import { ITileAddress } from "./tiles.interfaces";
import { TileMetrics } from "./tiles.metrics";

export class TileAddress implements ITileAddress {
    private _k?: string;

    public constructor(public x: number, public y: number, public levelOfDetail: number) {}
    public get quadkey(): string {
        if (!this._k) {
            this._k = TileMetrics.TileXYToQuadKey(this);
        }
        return this._k;
    }
    public toString(): string {
        return "x:" + this.x + ", y:" + this.y + ", lod:" + this.levelOfDetail + ", k:" + this.quadkey;
    }
}
