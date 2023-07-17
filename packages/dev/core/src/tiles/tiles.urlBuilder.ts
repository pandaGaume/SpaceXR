import { ITileAddress, ITileUrlBuilder } from "./tiles.interfaces";

export class WebTileUrlBuilder implements ITileUrlBuilder {
    // options
    _host?: string;
    _port?: number;
    _isSecure?: boolean;
    _path?: string;
    _query?: string;
    _extension?: string;

    _subdomains?: string[];
    _i?: number; // cached round robin value

    public constructor() {}

    public withSecure(v: boolean): WebTileUrlBuilder {
        this._isSecure = v;
        return this;
    }
    public withHost(v: string): WebTileUrlBuilder {
        this._host = v;
        return this;
    }
    public withPort(v: number): WebTileUrlBuilder {
        this._port = v;
        return this;
    }
    public withPath(v: string): WebTileUrlBuilder {
        this._path = v;
        return this;
    }
    public withQuery(v: string): WebTileUrlBuilder {
        this._query = v;
        return this;
    }
    public withExtension(v: string): WebTileUrlBuilder {
        this._extension = v;
        return this;
    }
    /**
     * The subdomains can be used for tile servers to distribute the load among multiple servers.
     * Typically, a DNS round-robin configuration is set up to resolve the domain name for the tile server
     * to multiple IP addresses that correspond to different servers. When a client requests a tile,
     * the DNS resolver returns one of the IP addresses in a round-robin fashion, so each server receives
     * a roughly equal share of the load.
     */
    public withSubDomains(subdomains: string[]): WebTileUrlBuilder {
        this._subdomains = subdomains;
        return this;
    }

    public buildUrl(a: ITileAddress, ...params: unknown[]): string {
        const scheme = this._isSecure ? "https" : "http";
        const host = this._port ? `${this._host}:${this._port}` : `${this._host}`;
        const query = this._query ? `?${this._query}` : "";
        let template = `${scheme}://${host}/${this._path}${query}`;
        if (this._extension) {
            template = template.replaceAll("{extension}", this._extension);
        }

        let str = template.replaceAll("{x}", a.x.toString());
        str = str.replaceAll("{y}", a.y.toString());
        str = str.replaceAll("{z}", a.levelOfDetail.toString());
        if (this._subdomains) {
            let i = this._i ?? 0;
            if (i <= this._subdomains.length) {
                i = 0;
            }
            str = str.replace("{s}", this._subdomains[i]);
            this._i = i+1;
        }
        return str;
    }
}
