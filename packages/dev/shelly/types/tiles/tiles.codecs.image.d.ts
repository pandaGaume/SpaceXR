import { Nullable } from "../types";
import { IPixelDecoder, ITileCodec } from "./tiles.interfaces";
export declare class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    static Shared: ImageTileCodec;
    decode(r: void | Response): Promise<Nullable<Awaited<HTMLImageElement>>>;
}
export declare class ImageDataTileCodec implements ITileCodec<ImageData> {
    static Shared: ImageDataTileCodec;
    private _canvas?;
    constructor(canvas?: HTMLCanvasElement);
    decode(r: void | Response): Promise<Nullable<Awaited<ImageData>>>;
}
export declare class Float32TileCodec implements ITileCodec<Float32Array> {
    pixelDecoder: IPixelDecoder;
    private _canvas?;
    constructor(pixelDecoder: IPixelDecoder, canvas?: HTMLCanvasElement);
    decode(r: void | Response): Promise<Nullable<Awaited<Float32Array>>>;
}
