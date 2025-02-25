import { ICartesian4 } from "../../geometry";
import { Nullable } from "../../types";
import { ImageDataTileCodecOptions } from "./tiles.codecs.image";
import { IPixelDecoder, ICodec } from "./tiles.codecs.interfaces";
export declare class Cartesian4TileCodecOptions extends ImageDataTileCodecOptions {
    factory?: () => ICartesian4;
    constructor(p: Partial<Cartesian4TileCodecOptions>);
}
export declare class Cartesian4TileCodec implements ICodec<Array<ICartesian4>> {
    pixelDecoder: IPixelDecoder<Array<ICartesian4>>;
    private _canvas?;
    private _options?;
    constructor(pixelDecoder: IPixelDecoder<Array<ICartesian4>>, options?: Cartesian4TileCodecOptions, canvas?: HTMLCanvasElement);
    decodeAsync(r: void | Response): Promise<Nullable<Array<ICartesian4>>>;
    protected _buildArray(size: number): Array<ICartesian4>;
}
