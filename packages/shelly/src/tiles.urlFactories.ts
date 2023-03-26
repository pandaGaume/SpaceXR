import { ITileAddress, ITileUrlFactory } from "./tiles.interfaces";
import { Utils } from "./utils";

/**
 * The round-robin strategy can be used for tile servers to distribute the load among multiple servers.
 * Typically, a DNS round-robin configuration is set up to resolve the domain name for the tile server
 * to multiple IP addresses that correspond to different servers. When a client requests a tile,
 * the DNS resolver returns one of the IP addresses in a round-robin fashion, so each server receives
 * a roughly equal share of the load.
 */
export class RoundRobinOptions {
    from = 0;
    to = 1;
}

export class WebTileUrlFactoryOptions {
    host?: string;
    port?: number;
    isSecure?: boolean;
    path?: string;
    query?: string;
    extension?: string;
    roundRobin?: RoundRobinOptions;
}

export class WebTileUrlFactory implements ITileUrlFactory {
    _o: WebTileUrlFactoryOptions; // the options
    _template: string; // url template
    _i: number; // cached round robin value

    public constructor(options: WebTileUrlFactoryOptions) {
        this._o = options;
        const scheme = this._o.isSecure ? "http" : "https";
        const host = this._o.port ? "${this._o.host}:${this._o.port}" : "${this._o.host}";
        const query = this._o.query ? "?${query}" : "";
        this._template = scheme + "://" + host + "/" + this._o.path + query;
        this._i = this._o.roundRobin ? this._o.roundRobin.from : 0;
    }

    protected buildUrl(request: ITileAddress, ...params: string[]): string {
        const keys = [this.nextRRIndex().toString(), request.x.toString(), request.y.toString(), request.levelOfDetail.toString()];
        if (this._o.extension) keys.push(this._o.extension);
        if (params) keys.push(...params);
        return Utils.Format(this._template, ...keys);
    }

    /**
     * this function is used by the round robin pattern to get the next index used as part of sub domains.
     * @returnsthe next index of the round robin, used as part of sub domains.
     */
    private nextRRIndex(): number {
        const i = this._i;
        if (this._o.roundRobin) {
            this._i = this._i == this._o.roundRobin.to ? this._o.roundRobin.from : this._i + 1;
        }
        return i;
    }
}

class MapZenTerrainUrlFactoryOptions extends WebTileUrlFactoryOptions {
    _type: string;

    public constructor(type: string, extension = "png") {
        super();
        this._type = type;
        this.host = "s{0}.amazonaws.com";
        this.path = "elevation-tiles-prod/" + type + "/{3}/{1}/{2}.{4}";
        this.isSecure = true;
        this.roundRobin = { from: 3, to: 3 };
        this.extension = extension;
    }
}

class GoogleMapUrlFactoryOptions extends WebTileUrlFactoryOptions {
    _type: string;

    public constructor(type: string) {
        super();
        this._type = type;
        this.host = "mts{0}.google.com";
        this.path = "vt/lyrs=" + type + "&x={1}&y={2}&z={3}";
        this.isSecure = true;
        this.roundRobin = { from: 0, to: 3 };
    }
}

export class KnownUrlFactoryOptions {
    public static MapZen = {
        TerrainTerrarium: new MapZenTerrainUrlFactoryOptions("terrarium"),
        Normal: new MapZenTerrainUrlFactoryOptions("normal"),
    };
    public static Google = {
        RoadOnly: new GoogleMapUrlFactoryOptions("h"),
        StandardRoadmap: new GoogleMapUrlFactoryOptions("m"),
        Terrain: new GoogleMapUrlFactoryOptions("p"),
        SomehowAlteredRoadmap: new GoogleMapUrlFactoryOptions("r"),
        SatelliteOnly: new GoogleMapUrlFactoryOptions("s"),
        TerrainOnly: new GoogleMapUrlFactoryOptions("t"),
        Hybrid: new GoogleMapUrlFactoryOptions("y"),
    };
}
