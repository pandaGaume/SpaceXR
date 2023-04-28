import { IPixelDecoder, ITileCodec } from "./tiles.interfaces";
export declare class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    static Shared: ImageTileCodec;
    decodeAsync(r: void | Response): Promise<HTMLImageElement | undefined>;
}
export declare class ImageDataTileCodec implements ITileCodec<ImageData> {
    static Shared: ImageDataTileCodec;
    private static CreateCanvas;
    private _canvas?;
    constructor(canvas?: HTMLCanvasElement);
    decodeAsync(r: void | Response): Promise<Awaited<ImageData> | undefined>;
}
export declare class Float32TileCodec implements ITileCodec<Float32Array> {
    pixelDecoder: IPixelDecoder;
    private _canvas?;
    constructor(pixelDecoder: IPixelDecoder, canvas?: HTMLCanvasElement);
    decodeAsync(r: void | Response): Promise<Awaited<Float32Array> | undefined>;
}
