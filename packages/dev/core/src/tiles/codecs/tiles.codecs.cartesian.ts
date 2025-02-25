import { ICartesian4 } from "../../geometry";
import { Nullable } from "../../types";
import { ImageDataTileCodec, ImageDataTileCodecOptions } from "./tiles.codecs.image";
import { IPixelDecoder, ICodec } from "./tiles.codecs.interfaces";

export class Cartesian4TileCodecOptions extends ImageDataTileCodecOptions {
    factory?: () => ICartesian4;

    public constructor(p: Partial<Cartesian4TileCodecOptions>) {
        super(p);
    }
}

export class Cartesian4TileCodec implements ICodec<Array<ICartesian4>> {
    private _canvas?: HTMLCanvasElement;
    private _options?: Cartesian4TileCodecOptions;

    public constructor(public pixelDecoder: IPixelDecoder<Array<ICartesian4>>, options?: Cartesian4TileCodecOptions, canvas?: HTMLCanvasElement) {
        this._canvas = canvas;
        this._options = options;
    }

    public async decodeAsync(r: void | Response): Promise<Nullable<Array<ICartesian4>>> {
        const imgData = await (this._canvas ? new ImageDataTileCodec(this._canvas, this._options) : ImageDataTileCodec.Shared).decodeAsync(r);
        if (imgData) {
            const pixels = imgData.data;
            const w = imgData.width;
            const h = imgData.height;
            const size = w * h;
            const pixelSize = pixels.length / size;
            const stride = imgData.width * pixelSize;

            const values = this._buildArray(size);

            let i = 0;

            // loop the rows
            for (let row = 0; row != imgData.height; row++) {
                const offset = stride * row;
                // then columns
                for (let column = 0; column != imgData.width; column++) {
                    i = this.pixelDecoder.decode(pixels, offset + column * pixelSize, values, i);
                }
            }

            return values;
        }
        return null;
    }

    protected _buildArray(size: number): Array<ICartesian4> {
        const a = new Array<ICartesian4>(size);
        if (this._options?.factory) {
            for (let i = 0; i < size; i++) {
                a[i] = this._options.factory();
            }
        }
        return a;
    }
}
