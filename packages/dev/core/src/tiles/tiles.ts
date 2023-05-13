import { IEnvelope } from "../geography/geography.interfaces";
import { Size3 } from "../geometry/geometry.size";
import { Geo3 } from "../geography/geography.position";
import { Envelope } from "../geography/geography.envelope";
import { ITile, ITileAddress, ITileBuilder, ITileMetrics } from "./tiles.interfaces";
import { TileMetrics } from "./tiles.metrics";
import { Nullable } from "../types";

export class TileBuilder<T> implements ITileBuilder<T> {
    _a?: ITileAddress;
    _d?: Nullable<T>;
    _m?: ITileMetrics;

    public withAddress(a: ITileAddress): ITileBuilder<T> {
        this._a = a;
        return this;
    }

    public withData(d: Nullable<T>): ITileBuilder<T> {
        this._d = d;
        return this;
    }

    public withMetrics(metrics: ITileMetrics): ITileBuilder<T> {
        this._m = metrics;
        return this;
    }
    public build(): ITile<T> {
        return new Tile<T>(this._a?.x || 0, this._a?.y || 0, this._a?.levelOfDetail || this._m?.minLOD || 0, this._d, this._m);
    }
}

export class Tile<T> implements ITile<T>, ITileAddress {
    public static Builder<T>(): ITileBuilder<T> {
        return new TileBuilder<T>();
    }

    public static BuildEnvelope(x: number, y: number, lod: number, metrics?: ITileMetrics): IEnvelope | undefined {
        if (metrics) {
            const nw = metrics.getTileXYToLatLon(x, y, lod);
            const se = metrics.getTileXYToLatLon(x + 1, y + 1, lod);
            const size = new Size3(nw.lat - se.lat, se.lon - nw.lon);
            const pos = new Geo3(se.lat, nw.lon);
            return Envelope.FromSize(pos, size);
        }
        return undefined;
    }
    private _k?: string;
    private _x: number;
    private _y: number;
    private _levelOfDetail: number;
    private _value: Nullable<T>;
    private _env?: IEnvelope;

    public constructor(x: number, y: number, levelOfDetail: number, data: Nullable<T> = null, metrics?: ITileMetrics) {
        this._x = x;
        this._y = y;
        this._levelOfDetail = levelOfDetail;
        this._value = data;
        this._env = Tile.BuildEnvelope(x, y, levelOfDetail, metrics);
    }

    public get address(): ITileAddress {
        return this;
    }

    public get content(): Nullable<T> {
        return this._value;
    }

    public set content(v: Nullable<T>) {
        this._value = v;
    }

    public get x(): number {
        return this._x;
    }
    public get y(): number {
        return this._y;
    }
    public get levelOfDetail(): number {
        return this._levelOfDetail;
    }

    public get bounds(): IEnvelope | undefined {
        return this._env;
    }

    public set bounds(e: IEnvelope | undefined) {
        this._env = e;
    }
    public get quadkey(): string {
        if (!this._k) {
            this._k = TileMetrics.TileXYToQuadKey(this);
        }
        return this._k;
    }
}
