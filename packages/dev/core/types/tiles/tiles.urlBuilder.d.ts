import { ITileAddress, ITileUrlBuilder } from "./tiles.interfaces";
export declare class WebTileUrlBuilder implements ITileUrlBuilder {
    _host?: string;
    _port?: number;
    _isSecure?: boolean;
    _path?: string;
    _query?: string;
    _extension?: string;
    _subdomains?: string[];
    _i?: number;
    constructor();
    withSecure(v: boolean): WebTileUrlBuilder;
    withHost(v: string): WebTileUrlBuilder;
    withPort(v: number): WebTileUrlBuilder;
    withPath(v: string): WebTileUrlBuilder;
    withQuery(v: string): WebTileUrlBuilder;
    withExtension(v: string): WebTileUrlBuilder;
    withSubDomains(subdomains: string[]): WebTileUrlBuilder;
    buildUrl(a: ITileAddress, ...params: unknown[]): string;
}
