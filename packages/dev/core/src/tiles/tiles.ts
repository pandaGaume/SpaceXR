import { IEnvelope } from "../geography/geography.interfaces";
import { Size3 } from "../geometry/geometry.size";
import { Geo3 } from "../geography/geography.position";
import { Envelope } from "../geography/geography.envelope";
import { ITile, ITileAddress, ITileBuilder, ITileMetrics } from "./tiles.interfaces";
import { TileMetrics } from "./tiles.metrics";
import { Nullable } from "../types";
import { IRectangle } from "../geometry/geometry.interfaces";
import { Rectangle } from "../geometry/geometry.rectangle";

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
        const t = new Tile<T>(this._a?.x || 0, this._a?.y || 0, this._a?.levelOfDetail || this._m?.minLOD || 0, this._d || null);
        if (this._m) {
            t.bounds = Tile.BuildEnvelope(t.address, this._m);
            t.rect = Tile.BuildBounds(t.address, this._m);
        }
        return t;
    }
}

export class Tile<T> implements ITile<T>, ITileAddress {
    public static Builder<T>(): ITileBuilder<T> {
        return new TileBuilder<T>();
    }

    public static BuildEnvelope(a: ITileAddress, metrics?: ITileMetrics): IEnvelope | undefined {
        if (metrics) {
            const nw = metrics.getTileXYToLatLon(a.x, a.y, a.levelOfDetail);
            const se = metrics.getTileXYToLatLon(a.x + 1, a.y + 1, a.levelOfDetail);
            const size = new Size3(nw.lat - se.lat, se.lon - nw.lon);
            const pos = new Geo3(se.lat, nw.lon);
            return Envelope.FromSize(pos, size);
        }
        return undefined;
    }

    public static BuildBounds(a: ITileAddress, metrics?: ITileMetrics): IRectangle | undefined {
        if (metrics) {
            const p = metrics.getTileXYToPixelXY(a.x, a.y, a.levelOfDetail);
            return new Rectangle(p.x, p.y, metrics.tileSize, metrics.tileSize);
        }
        return undefined;
    }

    private _k?: string;
    private _x: number;
    private _y: number;
    private _levelOfDetail: number;
    private _value?: Nullable<T>;
    private _env?: IEnvelope;
    private _rect?: IRectangle;

    public constructor(x: number, y: number, levelOfDetail: number, data?: Nullable<T>) {
        this._x = x;
        this._y = y;
        this._levelOfDetail = levelOfDetail;
        this._value = data;
    }

    public get address(): ITileAddress {
        return this;
    }

    public get content(): Nullable<T> | undefined {
        return this._value;
    }

    public set content(v: Nullable<T> | undefined) {
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

    public get rect(): IRectangle | undefined {
        return this._rect;
    }

    public set rect(r: IRectangle | undefined) {
        this._rect = r;
    }

    public get quadkey(): string {
        if (!this._k) {
            this._k = TileMetrics.TileXYToQuadKey(this);
        }
        return this._k;
    }
}
