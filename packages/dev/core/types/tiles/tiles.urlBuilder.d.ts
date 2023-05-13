import { ITileAddress, ITileUrlBuilder } from "./tiles.interfaces";
declare class RoundRobinOptions {
    from: number;
    to: number;
    constructor(f?: number, t?: number);
}
export declare class WebTileUrlBuilder implements ITileUrlBuilder {
    _host?: string;
    _port?: number;
    _isSecure?: boolean;
    _path?: string;
    _query?: string;
    _extension?: string;
    _roundRobin?: RoundRobinOptions;
    _i: number;
    constructor();
    withSecure(v: boolean): WebTileUrlBuilder;
    withHost(v: string): WebTileUrlBuilder;
    withPort(v: number): WebTileUrlBuilder;
    withPath(v: string): WebTileUrlBuilder;
    withQuery(v: string): WebTileUrlBuilder;
    withExtension(v: string): WebTileUrlBuilder;
    withRoundRobin(from: number, to: number): WebTileUrlBuilder;
    buildUrl(a: ITileAddress, ...params: unknown[]): string;
    private nextRRIndex;
}
export {};
