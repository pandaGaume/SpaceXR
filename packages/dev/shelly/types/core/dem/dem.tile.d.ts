import { Tile } from "../tiles/tiles.tile";
import { FloatArray, Nullable } from "../../types";
import { IDEMMetrics, IDEMTile, IDEMTileCodec, IRgbValueDecoder } from "./dem.interfaces";
export declare class DEMMetrics implements IDEMMetrics {
    min: number;
    max: number;
    mean?: number | undefined;
    static From(data: FloatArray): IDEMMetrics;
    constructor(min: number, max: number, mean?: number | undefined);
}
export declare class DEMTile extends Tile<FloatArray> implements IDEMTile {
    metrics: IDEMMetrics;
    constructor(data: FloatArray, metrics?: IDEMMetrics);
}
export declare class DEMTileCodec implements IDEMTileCodec {
    pixelDecoder: IRgbValueDecoder;
    constructor(pixelDecoder: IRgbValueDecoder);
    decode(r: void | Response): Promise<Nullable<DEMTile>>;
    protected createCanvas(width: number, height: number): HTMLCanvasElement | undefined;
}
export declare class MapzenRgbValueDecoder implements IRgbValueDecoder {
    static Shared: MapzenRgbValueDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, size: number): number;
}
export declare class CommonRgbValueDecoder implements IRgbValueDecoder {
    static Shared: CommonRgbValueDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, size: number): number;
}
