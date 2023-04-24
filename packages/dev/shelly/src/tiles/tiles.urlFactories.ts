import { ITileAddress, ITileUrlFactory } from "./tiles.interfaces";

/**
 * The round-robin strategy can be used for tile servers to distribute the load among multiple servers.
 * Typically, a DNS round-robin configuration is set up to resolve the domain name for the tile server
 * to multiple IP addresses that correspond to different servers. When a client requests a tile,
 * the DNS resolver returns one of the IP addresses in a round-robin fashion, so each server receives
 * a roughly equal share of the load.
 */
class RoundRobinOptions {
    from;
    to;
    public constructor(f = 0, t = 1) {
        this.from = f;
        this.to = t;
    }
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

export class WebTileUrlFactoryOptionsBuilder {
    _host?: string;
    _port?: number;
    _isSecure?: boolean;
    _path?: string;
    _query?: string;
    _extension?: string;
    _roundRobin?: RoundRobinOptions;

    public withSecure(v: boolean): WebTileUrlFactoryOptionsBuilder {
        this._isSecure = v;
        return this;
    }
    public withHost(v: string): WebTileUrlFactoryOptionsBuilder {
        this._host = v;
        return this;
    }
    public withPort(v: number): WebTileUrlFactoryOptionsBuilder {
        this._port = v;
        return this;
    }
    public withPath(v: string): WebTileUrlFactoryOptionsBuilder {
        this._path = v;
        return this;
    }
    public withQuery(v: string): WebTileUrlFactoryOptionsBuilder {
        this._query = v;
        return this;
    }
    public withExtension(v: string): WebTileUrlFactoryOptionsBuilder {
        this._extension = v;
        return this;
    }
    public withRoundRobin(from: number, to: number): WebTileUrlFactoryOptionsBuilder {
        this._roundRobin = new RoundRobinOptions(from, to);
        return this;
    }

    public build(): WebTileUrlFactoryOptions {
        return <WebTileUrlFactoryOptions>{
            host: this._host,
            port: this._port,
            path: this._path,
            query: this._query,
            extension: this._extension,
            roundRobin: this._roundRobin,
            isSecure: this._isSecure,
        };
    }
}

export class WebTileUrlFactory<T extends WebTileUrlFactoryOptions> implements ITileUrlFactory {
    _o: T; // the options
    _template: string; // url template
    _i: number; // cached round robin value

    public constructor(options: T) {
        this._o = options;
        const scheme = this._o.isSecure ? "http" : "https";
        const host = this._o.port ? `${this._o.host}:${this._o.port}` : `${this._o.host}`;
        const query = this._o.query ? `?${this._o.query}` : "";
        this._template = `${scheme}://${host}/${this._o.path}${query}`;
        if (this._o.extension) {
            this._template = this._template.replaceAll("{extension}", this._o.extension);
        }
        this._i = this._o.roundRobin ? this._o.roundRobin.from : 0;
    }

    public buildUrl(request: ITileAddress): string {
        let str = this._template.replaceAll("{x}", request.x.toString());
        str = str.replaceAll("{y}", request.y.toString());
        str = str.replaceAll("{z}", request.levelOfDetail.toString());
        str = this._template.replace("{s}", this._i.toString());
        this._i = this.nextRRIndex();
        return str;
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

export class GoogleMapUrlFactoryOptions extends WebTileUrlFactoryOptions {
    public static RoadOnly = new GoogleMapUrlFactoryOptions("h");
    public static StandardRoadmap = new GoogleMapUrlFactoryOptions("m");
    public static Terrain = new GoogleMapUrlFactoryOptions("p");
    public static SomehowAlteredRoadmap = new GoogleMapUrlFactoryOptions("r");
    public static SatelliteOnly = new GoogleMapUrlFactoryOptions("s");
    public static TerrainOnly = new GoogleMapUrlFactoryOptions("t");
    public static Hybrid = new GoogleMapUrlFactoryOptions("y");

    _type: string;

    public constructor(type: string) {
        super();
        this._type = type;
        this.host = "mts{s}.google.com";
        this.path = "vt/lyrs=${type}&x={x}&y={y}&z={z}";
        this.isSecure = true;
        this.roundRobin = { from: 0, to: 3 };
    }
}
