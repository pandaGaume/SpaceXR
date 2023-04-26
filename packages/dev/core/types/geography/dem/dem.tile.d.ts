import { ITileAddress, ITileMetrics } from "@dev/shelly/src/tiles/tiles.interfaces";
import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
import { GeographicTile } from "../geography.tile";
export declare class DEMMetrics {
    min: number;
    max: number;
    mean?: number | undefined;
    static From(data: Float32Array): DEMMetrics;
    constructor(min: number, max: number, mean?: number | undefined);
}
export declare class DEMTile extends GeographicTile<Float32Array> {
    static _PrepareLookupTable(fromDeg: number, toDeg: number, count: number, ellipsoid?: Ellipsoid): Float32Array;
    _dataMetrics: DEMMetrics;
    _normals?: Float32Array;
    _latLookupTable?: Float32Array;
    _lonLookupTable?: Float32Array;
    constructor(data: Float32Array, address: ITileAddress, metrics?: ITileMetrics);
    get dataMetrics(): DEMMetrics;
    get normals(): Float32Array | undefined;
    set normals(n: Float32Array | undefined);
    get latitudeLookupTable(): Float32Array | undefined;
    get longitudeLookupTable(): Float32Array | undefined;
    prepareLookupTable(ellipsoid?: Ellipsoid): void;
    clearLookupTable(): void;
}
