import { IEnvelope, Envelope } from "../geography";
import { ITile, ITileAddress, ITileMetrics, TileContentType } from "./tiles.interfaces";
import { IBounds2 } from "../geometry/geometry.interfaces";
import { Bounds2 } from "../geometry/geometry.bounds";
import { TileAddress } from "./address/tiles.address";

export class Tile<T> extends TileAddress implements ITile<T> {
    public static BuildEnvelope(t: ITile<unknown>, metrics?: ITileMetrics): IEnvelope | undefined {
        if (metrics) {
            if (metrics.geoBoundsFactory) {
                const b = metrics.geoBoundsFactory(t, metrics);
                if (b) {
                    return b;
                }
            }
            const a = t.address;
            const nw = metrics.getTileXYToLatLon(a.x, a.y, a.levelOfDetail);
            const se = metrics.getTileXYToLatLon(a.x + 1, a.y + 1, a.levelOfDetail);
            return Envelope.FromPoints(nw, se);
        }
        return undefined;
    }

    public static BuildBounds(t: ITile<unknown>, metrics?: ITileMetrics): IBounds2 | undefined {
        if (metrics) {
            if (metrics.boundsFactory) {
                const b = metrics.boundsFactory(t, metrics);
                if (b) {
                    return b;
                }
            }
            const a = t.address;
            const p = metrics.getTileXYToPointXY(a.x, a.y);
            return new Bounds2(p.x, p.y, metrics.tileSize, metrics.tileSize);
        }
        return undefined;
    }

    private _value: TileContentType<T>;
    private _env?: IEnvelope;
    private _rect?: IBounds2;
    private _ns?: string;

    public constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<T> = null, metrics?: ITileMetrics) {
        super(x, y, levelOfDetail);
        this._value = data;
        if (metrics) {
            this._env = Tile.BuildEnvelope(this, metrics);
            this._rect = Tile.BuildBounds(this, metrics);
        }
    }

    public get namespace(): string {
        return this._ns || "";
    }

    public set namespace(v: string) {
        this._ns = v;
    }

    public get address(): ITileAddress {
        return this;
    }

    public get content(): TileContentType<T> {
        return this._value;
    }

    public set content(v: TileContentType<T>) {
        this._value = v;
    }

    public get geoBounds(): IEnvelope | undefined {
        return this._env;
    }

    public set geoBounds(e: IEnvelope | undefined) {
        this._env = e;
    }

    public get bounds(): IBounds2 | undefined {
        return this._rect;
    }

    public set bounds(r: IBounds2 | undefined) {
        this._rect = r;
    }
}
