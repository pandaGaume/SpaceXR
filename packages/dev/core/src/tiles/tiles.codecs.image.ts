import { Nullable } from "../types";
import { IPixelDecoder, ITileCodec } from "./tiles.interfaces";

export class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    public static Shared = new ImageTileCodec();

    async decodeAsync(r: void | Response): Promise<Nullable<HTMLImageElement>> {
        const blob = r instanceof Response ? await r.blob() : null;
        if (blob) {
            return new Promise((resolve, reject) => {
                try {
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
                        resolve(img);
                    };
                    img.onerror = reject;
                    img.src = blobURL;
                } catch (e) {
                    reject(e);
                }
            });
        } else {
            return null;
        }
    }
}

export class ImageDataTileCodec implements ITileCodec<ImageData> {
    public static Shared = new ImageDataTileCodec();

    private static CreateCanvas(width: number, height: number): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    private _canvas?: HTMLCanvasElement;

    public constructor(canvas?: HTMLCanvasElement) {
        this._canvas = canvas;
    }

    public async decodeAsync(r: void | Response): Promise<Awaited<Nullable<ImageData>>> {
        const image = await ImageTileCodec.Shared.decodeAsync(r);
        if (image) {
            const w = image.width;
            const h = image.height;

            const workingCanvas = this._canvas || ImageDataTileCodec.CreateCanvas(w, h);
            if (!workingCanvas) {
                throw new Error("Unable to create 2d canvas");
            }
            const workingContext = workingCanvas.getContext("2d");
            if (!workingContext) {
                throw new Error("Unable to get 2d context");
            }

            workingContext.clearRect(0, 0, w, h);
            workingContext.drawImage(image, 0, 0);
            return workingContext.getImageData(0, 0, w, h);
        }
        return null;
    }
}

export class RGBTileCodec implements ITileCodec<Uint8ClampedArray> {
    private _canvas?: HTMLCanvasElement;

    public constructor(canvas?: HTMLCanvasElement) {
        this._canvas = canvas;
    }

    public async decodeAsync(r: void | Response): Promise<Awaited<Nullable<Uint8ClampedArray>>> {
        const imgData = await (this._canvas ? new ImageDataTileCodec(this._canvas) : ImageDataTileCodec.Shared).decodeAsync(r);
        if (imgData) {
            const pixels = imgData.data;
            const size = imgData.width * imgData.height;
            const n = pixels.length / size;
            // canvas always returning RGBA data
            if (n == 4) {
                const a = new Uint8ClampedArray(size * 3);
                for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
                    a[j] = pixels[i]; // R
                    a[j + 1] = pixels[i + 1]; // G
                    a[j + 2] = pixels[i + 2]; // B
                }
                return a;
            }
            return pixels;
        }
        return null;
    }
}

export class RGBATileCodec implements ITileCodec<Uint8ClampedArray> {
    private _canvas?: HTMLCanvasElement;

    public constructor(canvas?: HTMLCanvasElement) {
        this._canvas = canvas;
    }

    public async decodeAsync(r: void | Response): Promise<Awaited<Nullable<Uint8ClampedArray>>> {
        const imgData = await (this._canvas ? new ImageDataTileCodec(this._canvas) : ImageDataTileCodec.Shared).decodeAsync(r);
        if (imgData) {
            const pixels = imgData.data;
            return pixels;
        }
        return null;
    }
}

export class Float32TileCodec implements ITileCodec<Float32Array> {
    private _canvas?: HTMLCanvasElement;

    public constructor(public pixelDecoder: IPixelDecoder, canvas?: HTMLCanvasElement) {
        this._canvas = canvas;
    }

    public async decodeAsync(r: void | Response): Promise<Nullable<Float32Array>> {
        const imgData = await (this._canvas ? new ImageDataTileCodec(this._canvas) : ImageDataTileCodec.Shared).decodeAsync(r);
        if (imgData) {
            const pixels = imgData.data;
            const size = imgData.width * imgData.height;
            const pixelSize = pixels.length / size;
            const stride = imgData.width * pixelSize;

            const values = new Float32Array(size);

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
}
