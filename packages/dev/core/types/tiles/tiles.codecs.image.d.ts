import { Nullable } from "../types";
import { IPixelDecoder, ITileCodec } from "./tiles.interfaces";
export declare class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    static Shared: ImageTileCodec;
    decodeAsync(r: void | Response): Promise<Nullable<HTMLImageElement>>;
}
export declare class ImageDataTileCodec implements ITileCodec<ImageData> {
    static Shared: ImageDataTileCodec;
    private static CreateCanvas;
    private _canvas?;
    constructor(canvas?: HTMLCanvasElement);
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<ImageData>>>;
}
export declare class RGBTileCodec implements ITileCodec<Uint8ClampedArray> {
    private _canvas?;
    constructor(canvas?: HTMLCanvasElement);
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<Uint8ClampedArray>>>;
}
export declare class RGBATileCodec implements ITileCodec<Uint8ClampedArray> {
    private _canvas?;
    constructor(canvas?: HTMLCanvasElement);
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<Uint8ClampedArray>>>;
}
export declare class Float32TileCodec implements ITileCodec<Float32Array> {
    pixelDecoder: IPixelDecoder;
    private _canvas?;
    constructor(pixelDecoder: IPixelDecoder, canvas?: HTMLCanvasElement);
    decodeAsync(r: void | Response): Promise<Nullable<Float32Array>>;
}
