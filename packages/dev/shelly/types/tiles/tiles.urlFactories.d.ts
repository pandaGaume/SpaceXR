import { ITileAddress, ITileUrlFactory } from "./tiles.interfaces";
declare class RoundRobinOptions {
    from: number;
    to: number;
    constructor(f?: number, t?: number);
}
export declare class WebTileUrlFactoryOptions {
    host?: string;
    port?: number;
    isSecure?: boolean;
    path?: string;
    query?: string;
    extension?: string;
    roundRobin?: RoundRobinOptions;
}
export declare class WebTileUrlFactoryOptionsBuilder {
    _host?: string;
    _port?: number;
    _isSecure?: boolean;
    _path?: string;
    _query?: string;
    _extension?: string;
    _roundRobin?: RoundRobinOptions;
    withSecure(v: boolean): WebTileUrlFactoryOptionsBuilder;
    withHost(v: string): WebTileUrlFactoryOptionsBuilder;
    withPort(v: number): WebTileUrlFactoryOptionsBuilder;
    withPath(v: string): WebTileUrlFactoryOptionsBuilder;
    withQuery(v: string): WebTileUrlFactoryOptionsBuilder;
    withExtension(v: string): WebTileUrlFactoryOptionsBuilder;
    withRoundRobin(from: number, to: number): WebTileUrlFactoryOptionsBuilder;
    build(): WebTileUrlFactoryOptions;
}
export declare class WebTileUrlFactory<T extends WebTileUrlFactoryOptions> implements ITileUrlFactory {
    _o: T;
    _template: string;
    _i: number;
    constructor(options: T);
    buildUrl(request: ITileAddress): string;
    private nextRRIndex;
}
export declare class GoogleMapUrlFactoryOptions extends WebTileUrlFactoryOptions {
    static RoadOnly: GoogleMapUrlFactoryOptions;
    static StandardRoadmap: GoogleMapUrlFactoryOptions;
    static Terrain: GoogleMapUrlFactoryOptions;
    static SomehowAlteredRoadmap: GoogleMapUrlFactoryOptions;
    static SatelliteOnly: GoogleMapUrlFactoryOptions;
    static TerrainOnly: GoogleMapUrlFactoryOptions;
    static Hybrid: GoogleMapUrlFactoryOptions;
    _type: string;
    constructor(type: string);
}
export {};
