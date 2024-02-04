import { ITile, ITileAddress, ITileBuilder, ITileMetrics, TileContentType } from "./tiles.interfaces";
import { Tile } from "./tiles";

export class TileBuilder<T> implements ITileBuilder<T> {
    _ns?: string;
    _a?: ITileAddress;
    _d?: TileContentType<T>;
    _m?: ITileMetrics;
    _t?: new (...args: any[]) => ITile<T>;

    public withNamespace(namesapce: string): ITileBuilder<T> {
        this._ns = namesapce;
        return this;
    }

    public withAddress(a: ITileAddress): ITileBuilder<T> {
        this._a = a;
        return this;
    }

    public withData(d: TileContentType<T>): ITileBuilder<T> {
        this._d = d;
        return this;
    }

    public withMetrics(metrics: ITileMetrics): ITileBuilder<T> {
        this._m = metrics;
        return this;
    }

    public withType(type: new (...args: any[]) => ITile<T>): ITileBuilder<T> {
        this._t = type;
        return this;
    }

    public build(): ITile<T> {
        const type = this._t ?? Tile<T>;
        const t = new type(this._a?.x || 0, this._a?.y || 0, this._a?.levelOfDetail || this._m?.minLOD || 0, this._d || null);
        if (this._m) {
            t.bounds = Tile.BuildEnvelope(t.address, this._m);
            t.rect = Tile.BuildBounds(t.address, this._m);
        }
        return t;
    }
}
