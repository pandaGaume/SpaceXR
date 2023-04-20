import { FloatArray, Nullable } from "../types";
import { Utils } from "../utils";
import { IFloatTile, IFloatTileMetrics, IRgbValueDecoder, ITile, ITileCodec } from "./tiles.interfaces";

export class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    public static Shared = new ImageTileCodec();

    async decode(r: void | Response): Promise<Nullable<Awaited<ITile<HTMLImageElement>>>> {
        const blob = r instanceof Response ? await r.blob() : null;
        if (blob) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const blobURL = URL.createObjectURL(blob);
                // this frees up memory, which is usually handled automatically when you close the
                // page or navigate away from it
                img.onload = function (ev) {
                    const e = ev.target;
                    if (e && e instanceof HTMLImageElement) {
                        URL.revokeObjectURL(e.src);
                        e.onload = null;
                    }
                    // then call the resolve part of the promise.
                    resolve(<ITile<HTMLImageElement>>{ data: img });
                };
                img.onerror = reject;
                img.src = blobURL;
            });
        } else {
            return null;
        }
    }
}

export class ImageDataTileCodec implements ITileCodec<ImageData> {
    public static Shared = new ImageDataTileCodec();

    private _canvas?: HTMLCanvasElement;

    public constructor(canvas?: HTMLCanvasElement) {
        this._canvas = canvas;
    }

    public async decode(r: void | Response): Promise<Nullable<Awaited<ITile<ImageData>>>> {
        const tileImg = await ImageTileCodec.Shared.decode(r);
        if (tileImg?.data) {
            const image = tileImg.data;
            const w = image.width;
            const h = image.height;

            const workingCanvas = this._canvas || Utils.CreateCanvas(w, h);
            if (!workingCanvas) {
                throw new Error("Unable to create 2d canvas");
            }
            const workingContext = workingCanvas.getContext("2d");
            if (!workingContext) {
                throw new Error("Unable to get 2d context");
            }

            workingContext.clearRect(0, 0, w, h);
            workingContext.drawImage(image, 0, 0);
            return <ITile<ImageData>>{ data: workingContext.getImageData(0, 0, w, h) };
        }
        return null;
    }
}

export class FloatTileMetrics implements IFloatTileMetrics {
    public static From(data: FloatArray): IFloatTileMetrics {
        let min = Number.MAX_VALUE;
        let max = Number.MIN_VALUE;
        let v = data[0];
        if (v < min) min = v;
        else if (v > max) max = v;

        let mean = v / data.length;
        for (let i = 1; i < data.length; i++) {
            v = data[i];
            if (v < min) min = v;
            else if (v > max) max = v;
            mean += v / data.length;
        }
        return new FloatTileMetrics(min, max, mean);
    }

    /**
     *
     * @param min
     * @param max
     * @param mean
     */
    constructor(public min: number, public max: number, public mean?: number) {}
}

export class ImageDecoderTileCodec implements ITileCodec<Float32Array> {
    private _canvas?: HTMLCanvasElement;

    public constructor(public pixelDecoder: IRgbValueDecoder<number>, canvas?: HTMLCanvasElement) {
        this._canvas = canvas;
    }

    public async decode(r: void | Response): Promise<Nullable<Awaited<IFloatTile>>> {
        const tile = await (this._canvas ? new ImageDataTileCodec(this._canvas) : ImageDataTileCodec.Shared).decode(r);
        if (tile?.data) {
            const imgData = tile.data;
            const pixels = imgData.data;
            const size = imgData.width * imgData.height;
            const n = pixels.length / size;
            const stride = imgData.width * n;

            const values = new Float32Array(size);
            let min = Number.MAX_SAFE_INTEGER;
            let max = Number.MIN_SAFE_INTEGER;

            // initialize mean value
            let z: number = this.pixelDecoder.decode(pixels, 0, n);
            values[0] = z;
            let mean = -z / size;
            // loop the rows
            for (let row = 0; row != imgData.height; row++) {
                const offset = stride * row;
                const zoffset = imgData.width * row;
                // then columns
                for (let column = 0; column != imgData.width; column++) {
                    z = this.pixelDecoder.decode(pixels, offset + column * n, n);
                    values[zoffset + column] = z;
                    min = Math.min(z, min);
                    max = Math.max(z, max);
                    mean += z / size;
                }
            }

            return <IFloatTile>{ metrics: new FloatTileMetrics(min, max, mean), data: values };
        }
        return null;
    }
}
