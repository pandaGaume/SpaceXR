import { ITileAddress, ITileUrlFactory } from "./tiles.interfaces";
export declare class RoundRobinOptions {
    from: number;
    to: number;
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
export declare class WebTileUrlFactory implements ITileUrlFactory {
    _o: WebTileUrlFactoryOptions;
    _template: string;
    _i: number;
    constructor(options: WebTileUrlFactoryOptions);
    buildUrl(request: ITileAddress, ...params: string[]): string;
    private nextRRIndex;
}
declare class GoogleMapUrlFactoryOptions extends WebTileUrlFactoryOptions {
    _type: string;
    constructor(type: string);
}
export declare class KnownUrlFactoryOptions {
    static Google: {
        RoadOnly: GoogleMapUrlFactoryOptions;
        StandardRoadmap: GoogleMapUrlFactoryOptions;
        Terrain: GoogleMapUrlFactoryOptions;
        SomehowAlteredRoadmap: GoogleMapUrlFactoryOptions;
        SatelliteOnly: GoogleMapUrlFactoryOptions;
        TerrainOnly: GoogleMapUrlFactoryOptions;
        Hybrid: GoogleMapUrlFactoryOptions;
    };
}
export {};
