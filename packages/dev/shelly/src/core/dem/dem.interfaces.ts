import { ITile, ITileCodec } from "../tiles/tiles.interfaces";
import { FloatArray } from "../../types";

export interface IDEMMetrics {
    min: number;
    max: number;
    mean?: number;
}

export interface IDEMTile extends ITile<FloatArray> {
    metrics: IDEMMetrics;
}

export interface IRgbValueDecoder {
    decode(pixels: Uint8ClampedArray, offset: number, size: number): number;
}

export interface IDEMTileCodec extends ITileCodec<FloatArray> {
    pixelDecoder: IRgbValueDecoder;
}
