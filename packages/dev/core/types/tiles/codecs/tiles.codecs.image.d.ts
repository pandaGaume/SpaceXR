import { IPixelDecoder } from "./tiles.codecs.interfaces";
import { Nullable } from "../../types";
import { ITileCodec } from "../tiles.interfaces";
import { Side } from "../../geometry/geometry.interfaces";
export declare class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    static Shared: ImageTileCodec;
    decodeAsync(r: void | Response): Promise<Nullable<HTMLImageElement>>;
}
export declare class ImageDataTileCodecOptions {
    insets?: [number, number, number, number];
    constructor(p: Partial<ImageDataTileCodecOptions>);
}
export declare class ImageDataTileCodecOptionsBuilder {
    _insets?: [number, number, number, number];
    withInsets(v: number, side: Side): ImageDataTileCodecOptionsBuilder;
    build(): ImageDataTileCodecOptions;
}
export declare class ImageDataTileCodec implements ITileCodec<ImageData> {
    static Shared: ImageDataTileCodec;
    private static CreateCanvas;
    private _canvas?;
    private _options?;
    constructor(canvas?: HTMLCanvasElement, options?: ImageDataTileCodecOptions);
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
export declare class Float32TileCodecOptions extends ImageDataTileCodecOptions {
    constructor(p: Partial<Float32TileCodecOptions>);
}
export declare class Float32TileCodecOptionsBuilder extends ImageDataTileCodecOptionsBuilder {
}
export declare class Float32TileCodec implements ITileCodec<Float32Array> {
    pixelDecoder: IPixelDecoder<Float32Array>;
    private _canvas?;
    private _options?;
    constructor(pixelDecoder: IPixelDecoder<Float32Array>, options?: Float32TileCodecOptions, canvas?: HTMLCanvasElement);
    decodeAsync(r: void | Response): Promise<Nullable<Float32Array>>;
}
