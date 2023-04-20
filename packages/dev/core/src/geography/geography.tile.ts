import { Tile } from "shelly/src/tiles/tiles.tile";
import { ITileAddress, ITileMetrics } from "shelly/src/tiles/tiles.interfaces";
import { IEnvelope, IGeoBounded } from "./geography.interfaces";
import { Size } from "./geography.size";
import { Location } from "./geography.location";
import { Envelope } from "./geography.envelope";

export class GeographicTile<T> extends Tile<T> implements IGeoBounded {
    _metrics: ITileMetrics;
    _env?: IEnvelope;

    public constructor(data: T, address: ITileAddress, metrics: ITileMetrics) {
        super(data, address);
        this._metrics = metrics;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get bounds(): IEnvelope | undefined {
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
        const nw = this._metrics.getTileXYToLatLon(x, y, lod);
        const se = this._metrics.getTileXYToLatLon(x + 1, y + 1, lod);
        const size = new Size(nw.lat - se.lat, se.lon - nw.lon);
        const pos = new Location(se.lat, nw.lon);
        return Envelope.FromSize(pos, size);
    }
}
