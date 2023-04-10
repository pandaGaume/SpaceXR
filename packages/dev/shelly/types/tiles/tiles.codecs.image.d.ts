import { FloatArray, Nullable } from "../types";
import { IFloatTile, IFloatTileMetrics, IRgbValueDecoder, ITile, ITileCodec } from "./tiles.interfaces";
export declare class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    static Shared: ImageTileCodec;
    decode(r: void | Response): Promise<Nullable<Awaited<ITile<HTMLImageElement>>>>;
}
export declare class ImageDataTileCodec implements ITileCodec<ImageData> {
    static Shared: ImageDataTileCodec;
    private _canvas?;
    constructor(canvas?: HTMLCanvasElement);
    decode(r: void | Response): Promise<Nullable<Awaited<ITile<ImageData>>>>;
}
export declare class FloatTileMetrics implements IFloatTileMetrics {
    min: number;
    max: number;
    mean?: number | undefined;
    static From(data: FloatArray): IFloatTileMetrics;
    constructor(min: number, max: number, mean?: number | undefined);
}
export declare class ImageDecoderTileCodec implements ITileCodec<FloatArray> {
    pixelDecoder: IRgbValueDecoder;
    private _canvas?;
    constructor(pixelDecoder: IRgbValueDecoder, canvas?: HTMLCanvasElement);
    decode(r: void | Response): Promise<Nullable<Awaited<IFloatTile>>>;
}
