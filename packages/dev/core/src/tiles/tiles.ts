import { IEnvelope } from "../geography/geography.interfaces";
import { Size3 } from "../geometry/geometry.size";
import { Geo3 } from "../geography/geography.position";
import { Envelope } from "../geography/geography.envelope";
import { ITile, ITileAddress, ITileMetrics } from "./tiles.interfaces";

export class Tile<T> implements ITile<T>, ITileAddress {
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
    _x: number;
    _y: number;
    _levelOfDetail: number;
    _value?: T;
    _env?: IEnvelope;

    public constructor(x: number, y: number, levelOfDetail: number, data?: T, metrics?: ITileMetrics) {
        this._x = x;
        this._y = y;
        this._levelOfDetail = levelOfDetail;
        this._value = data;
        this._env = Tile.BuildEnvelope(x, y, levelOfDetail, metrics);
    }

    public get address(): ITileAddress | undefined {
        return this;
    }

    public get data(): T | undefined {
        return this._value;
    }

    public set data(v: T | undefined) {
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
}
