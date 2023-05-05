import { IPixelDecoder, ITileCodec } from "./tiles.interfaces";

export class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    public static Shared = new ImageTileCodec();

    async decodeAsync(r: void | Response): Promise<HTMLImageElement | undefined> {
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
            return undefined;
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

    public async decodeAsync(r: void | Response): Promise<Awaited<ImageData> | undefined> {
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
        return undefined;
    }
}

export class Float32TileCodec implements ITileCodec<Float32Array> {
    private _canvas?: HTMLCanvasElement;

    public constructor(public pixelDecoder: IPixelDecoder, canvas?: HTMLCanvasElement) {
        this._canvas = canvas;
    }

    public async decodeAsync(r: void | Response): Promise<Awaited<Float32Array> | undefined> {
        const imgData = await (this._canvas ? new ImageDataTileCodec(this._canvas) : ImageDataTileCodec.Shared).decodeAsync(r);
        if (imgData) {
            const pixels = imgData.data;
            const size = imgData.width * imgData.height;
            const n = pixels.length / size;
            const stride = imgData.width * n;

            const values = new Float32Array(size);

            // initialize mean value
            let i = this.pixelDecoder.decode(pixels, 0, values, 0);
            // loop the rows
            for (let row = 0; row != imgData.height; row++) {
                const offset = stride * row;
                // then columns
                for (let column = 0; column != imgData.width; column++) {
                    i = this.pixelDecoder.decode(pixels, offset + column * n, values, i);
                }
            }

            return values;
        }
        return undefined;
    }
}
