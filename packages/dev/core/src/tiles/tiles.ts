import { IEnvelope } from "../geography/geography.interfaces";
import { Size3 } from "../geometry/geometry.size";
import { Geo3 } from "../geography/geography.position";
import { Envelope } from "../geography/geography.envelope";
import { ITile, ITileAddress, ITileBuilder, ITileContentView, ITileMetrics, TileContent, TileSection } from "./tiles.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
import { Rectangle } from "../geometry/geometry.rectangle";
import { TileAddress } from "./tiles.address";

export class TileBuilder<T> implements ITileBuilder<T> {
    _a?: ITileAddress;
    _d?: TileContent<T>;
    _m?: ITileMetrics;

    public withAddress(a: ITileAddress): ITileBuilder<T> {
        this._a = a;
        return this;
    }

    public withData(d: TileContent<T>): ITileBuilder<T> {
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

export class TileContentView implements ITileContentView {
    public static BuildKey(address: ITileAddress, source?: TileSection, target?: TileSection) {
        return `${address.quadkey}_${source?.toString() ?? "x"}_${target?.toString() ?? "x"}`;
    }

    private _key?: string;

    public constructor(public address: ITileAddress, public source?: TileSection, public target?: TileSection) {}

    public get key(): string {
        if (!this._key) {
            this._key = TileContentView.BuildKey(this.address, this.source, this.target);
        }
        return this._key;
    }
}

export class Tile<T> extends TileAddress implements ITile<T> {
    public static Builder<T>(): ITileBuilder<T> {
        return new TileBuilder<T>();
    }

    public static BuildEnvelope(a: ITileAddress, metrics?: ITileMetrics): IEnvelope | undefined {
        if (metrics) {
            const nw = metrics.getTileXYToLatLon(a.x, a.y, a.levelOfDetail);
            const se = metrics.getTileXYToLatLon(a.x + 1, a.y + 1, a.levelOfDetail);
            const size = new Size3(nw.lat - se.lat, se.lon - nw.lon, 0);
            const pos = new Geo3(se.lat, nw.lon);
            return Envelope.FromSize(pos, size);
        }
        return undefined;
    }

    public static BuildBounds(a: ITileAddress, metrics?: ITileMetrics): IRectangle | undefined {
        if (metrics) {
            const p = metrics.getTileXYToPixelXY(a.x, a.y);
            return new Rectangle(p.x, p.y, metrics.tileSize, metrics.tileSize);
        }
        return undefined;
    }

    private _value: TileContent<T>;
    private _env?: IEnvelope;
    private _rect?: IRectangle;

    public constructor(x: number, y: number, levelOfDetail: number, data: TileContent<T>) {
        super(x, y, levelOfDetail);
        this._value = data;
    }

    public get address(): ITileAddress {
        return this;
    }
    public get key(): string {
        return this.address.quadkey;
    }

    public get content(): TileContent<T> {
        return this._value;
    }

    public set content(v: TileContent<T>) {
        this._value = v;
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
}
