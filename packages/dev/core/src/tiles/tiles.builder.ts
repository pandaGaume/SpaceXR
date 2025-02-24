import { ITile, ITileAddress2, ITileBuilder, ITileMetrics, TileContentType } from "./tiles.interfaces";
import { Tile } from "./tiles";

export class TileBuilder<T> implements ITileBuilder<T> {
    public static SharedBuilder<T>(): ITileBuilder<T> {
        return new TileBuilder<T>();
    }

    _ns?: string;
    _a?: ITileAddress2;
    _d?: TileContentType<T>;
    _m?: ITileMetrics;
    _t?: new (...args: any[]) => ITile<T>;
    _c?: Array<ITile<T>>;

    public get metrics(): ITileMetrics {
        return this._m!;
    }

    public get namespace(): string {
        return this._ns ?? "";
    }

    public withNamespace(namespace: string): ITileBuilder<T> {
        this._ns = namespace;
        return this;
    }

    public withAddress(a: ITileAddress2): ITileBuilder<T> {
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
            t.geoBounds = Tile.BuildEnvelope(t, this._m);
            t.boundingBox = Tile.BuildBounds(t, this._m);
        }

        return t;
    }
}
