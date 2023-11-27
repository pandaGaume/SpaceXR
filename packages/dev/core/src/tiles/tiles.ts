import { IEnvelope } from "../geography/geography.interfaces";
import { Size3 } from "../geometry/geometry.size";
import { Geo3 } from "../geography/geography.position";
import { Envelope } from "../geography/geography.envelope";
import { ITile, ITileAddress, ITileContentView, ITileMetrics, TileContent, TileSection } from "./tiles.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
import { Rectangle } from "../geometry/geometry.rectangle";
import { TileAddress } from "./tiles.address";

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
    private static BuildEnvelope(a: ITileAddress, metrics?: ITileMetrics): IEnvelope | undefined {
        if (metrics) {
            const nw = metrics.getTileXYToLatLon(a.x, a.y, a.levelOfDetail);
            const se = metrics.getTileXYToLatLon(a.x + 1, a.y + 1, a.levelOfDetail);
            const size = new Size3(nw.lat - se.lat, se.lon - nw.lon, 0);
            const pos = new Geo3(se.lat, nw.lon);
            return Envelope.FromSize(pos, size);
        }
        return undefined;
    }

    private static BuildBounds(a: ITileAddress, metrics?: ITileMetrics): IRectangle | undefined {
        if (metrics) {
            const p = metrics.getTileXYToPixelXY(a.x, a.y);
            return new Rectangle(p.x, p.y, metrics.tileSize, metrics.tileSize);
        }
        return undefined;
    }

    private _value?: TileContent<T>;
    private _env?: IEnvelope;
    private _rect?: IRectangle;
    private _metrics: ITileMetrics;

    public constructor(x: number, y: number, levelOfDetail: number, metrics: ITileMetrics, data?: TileContent<T>) {
        super(x, y, levelOfDetail);
        this._metrics = metrics;
        this._value = data;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get address(): ITileAddress {
        return this;
    }
    public get key(): string {
        return this.address.quadkey;
    }

    public get content(): TileContent<T> | undefined {
        return this._value;
    }

    public set content(v: TileContent<T> | undefined) {
        this._value = v;
    }

    public get bounds(): IEnvelope | undefined {
        if (!this._env) {
            this._env = Tile.BuildEnvelope(this.address, this.metrics);
        }
        return this._env;
    }

    public get rect(): IRectangle | undefined {
        if (!this._rect) {
            this._rect = Tile.BuildBounds(this.address, this.metrics);
        }
        return this._rect;
    }
}
