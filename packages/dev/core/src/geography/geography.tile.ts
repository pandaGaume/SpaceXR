import { Tile } from "shelly/src/tiles/tiles.tile";
import { ITileAddress, ITileMetrics } from "shelly/src/tiles/tiles.interfaces";
import { IEnvelope, IGeoBounded } from "./geography.interfaces";
import { Size } from "./geography.size";
import { Geo3 } from "./geography.geo3";
import { Envelope } from "./geography.envelope";
import { WebMercatorTileMetrics } from "shelly/src/tiles/tiles.metrics.webMercator";

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
