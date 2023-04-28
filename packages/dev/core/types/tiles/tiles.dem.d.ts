import { ITileMetrics } from "./tiles.interfaces";
import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
import { Tile } from "./tiles";
export declare class DEMMetaData {
    min: number;
    max: number;
    mean?: number | undefined;
    static From(data?: Float32Array): DEMMetaData | undefined;
    constructor(min: number, max: number, mean?: number | undefined);
}
export declare class DEMTile extends Tile<Float32Array> {
    static _PrepareLookupTable(fromDeg: number, toDeg: number, count: number, ellipsoid?: Ellipsoid): Float32Array;
    _dataMetrics?: DEMMetaData;
    _normals?: Float32Array;
    _latLookupTable?: Float32Array;
    _lonLookupTable?: Float32Array;
    constructor(x: number, y: number, levelOfDetail: number, data?: Float32Array, metrics?: ITileMetrics);
    get dataMetrics(): DEMMetaData | undefined;
    get normals(): Float32Array | undefined;
    set normals(n: Float32Array | undefined);
    get latitudeLookupTable(): Float32Array | undefined;
    get longitudeLookupTable(): Float32Array | undefined;
    prepareLookupTable(tileSize: number, ellipsoid?: Ellipsoid): void;
    clearLookupTable(): void;
}
