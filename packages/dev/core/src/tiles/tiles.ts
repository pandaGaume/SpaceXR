import { IEnvelope } from "../geography/geography.interfaces";
import { Size3 } from "../geometry/geometry.size";
import { Geo3 } from "../geography/geography.position";
import { Envelope } from "../geography/geography.envelope";
import { ITile, ITileAddress, ITileMetrics, TileContentType } from "./tiles.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
import { Rectangle } from "../geometry/geometry.rectangle";
import { TileAddress } from "./address/tiles.address";

export class Tile<T> extends TileAddress implements ITile<T> {


    public static BuildEnvelope(a: ITileAddress, metrics?: ITileMetrics): IEnvelope | undefined {
        if (metrics) {
            const nw = metrics.getTileXYToLatLon(a.x, a.y, a.levelOfDetail);
            const se = metrics.getTileXYToLatLon(a.x + 1, a.y + 1, a.levelOfDetail);
            const size = new Size3(nw.lat - se.lat, se.lon - nw.lon, 0);
            const pos = new Geo3(se.lat, nw.lon);
            return Envelope.FromSizeAngles(pos, size);
        }
        return undefined;
    }

    public static BuildBounds(a: ITileAddress, metrics?: ITileMetrics): IRectangle | undefined {
        if (metrics) {
            const p = metrics.getTileXYToPointXY(a.x, a.y);
            return new Rectangle(p.x, p.y, metrics.tileSize, metrics.tileSize);
        }
        return undefined;
    }

    private _value: TileContentType<T>;
    private _env?: IEnvelope;
    private _rect?: IRectangle;
    private _ns?: string;

    public constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<T>) {
        super(x, y, levelOfDetail);
        this._value = data;
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
