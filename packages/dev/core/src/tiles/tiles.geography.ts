import { Tile } from "./tiles.tile";
import { ITileAddress, ITileMetrics } from "./tiles.interfaces";
import { AbstractTileMetrics } from "./tiles.metrics";
import { ICartesian2, IEnvelope, IGeo3, IGeoBounded } from "../geography/geography.interfaces";
import { Size } from "../geography/geography.size";
import { Geo3 } from "../geography/geography.geo3";
import { Envelope } from "../geography/geography.envelope";
import { Scalar } from "../math/math";

export class WebMercatorTileMetrics extends AbstractTileMetrics {
    private static D2R = Math.PI / 180;

    public static Shared = new WebMercatorTileMetrics();

    public getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2 {
        latitude = Scalar.Clamp(latitude, this.minLatitude, this.maxLatitude);
        longitude = Scalar.Clamp(longitude, this.minLongitude, this.maxLongitude);

        const n = Math.pow(2, levelOfDetail);
        const x = Math.floor(((longitude + 180) / 360) * n);
        const lat_rad = latitude * WebMercatorTileMetrics.D2R;
        const y = Math.floor(((1 - Math.log(Math.tan(lat_rad) + 1 / Math.cos(lat_rad)) / Math.PI) / 2) * n);
        if (tileXY) {
            tileXY.x = x;
            tileXY.y = y;
            return tileXY;
        }
        return <ICartesian2>{ x: x, y: y };
    }

    public getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: IGeo3 | undefined): IGeo3 {
        let n = Math.pow(2, levelOfDetail);
        const lon = -180 + (x / n) * 360;
        n = Math.PI - (2 * Math.PI * y) / n;
        const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

        if (loc) {
            loc.lat = lat;
            loc.lon = lon;
            return loc;
        }
        return <IGeo3>{ lat: lat, lon: lon };
    }
}

export class GeographicTile<T> extends Tile<T> implements IGeoBounded {
    _tileMetrics: ITileMetrics;
    _env?: IEnvelope;

    public constructor(data: T, address: ITileAddress, metrics?: ITileMetrics) {
        super(data, address);
        this._tileMetrics = metrics || WebMercatorTileMetrics.Shared;
    }

    public get tileMetrics(): ITileMetrics {
        return this._tileMetrics;
    }

    public get bounds(): IEnvelope {
        if (!this._env) {
            this._env = this.buildEnvelope();
        }
        return this._env;
    }

    public set bounds(e: IEnvelope | undefined) {
        this._env = e;
    }

    private buildEnvelope(): IEnvelope {
        const x = this.address?.x || 0;
        const y = this.address?.x || 0;
        const lod = this.address?.levelOfDetail || 0;
        const nw = this._tileMetrics.getTileXYToLatLon(x, y, lod);
        const se = this._tileMetrics.getTileXYToLatLon(x + 1, y + 1, lod);
        const size = new Size(nw.lat - se.lat, se.lon - nw.lon);
        const pos = new Geo3(se.lat, nw.lon);
        return Envelope.FromSize(pos, size);
    }
}
