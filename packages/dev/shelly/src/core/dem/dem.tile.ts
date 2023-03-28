import { ImageTileCodec } from "../tiles/tiles.codecs";
import { Tile } from "../tiles/tiles.tile";
import { FloatArray, Nullable } from "../../types";
import { IDEMMetrics, IDEMTile, IDEMTileCodec, IRgbValueDecoder } from "./dem.interfaces";

export class DEMMetrics implements IDEMMetrics {
    public static From(data: FloatArray): IDEMMetrics {
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
        return new DEMMetrics(min, max, mean);
    }

    /**
     *
     * @param min
     * @param max
     * @param mean
     */
    constructor(public min: number, public max: number, public mean?: number) {}
}

/**
 *
 */
export class DEMTile extends Tile<FloatArray> implements IDEMTile {
    metrics: IDEMMetrics;

    public constructor(data: FloatArray, metrics?: IDEMMetrics) {
        super(data);
        this.metrics = metrics || DEMMetrics.From(data);
    }
}

export class DEMTileCodec implements IDEMTileCodec {
    public constructor(public pixelDecoder: IRgbValueDecoder) {}

    public async decode(r: void | Response): Promise<Nullable<DEMTile>> {
        const tileImg = await ImageTileCodec.Shared.decode(r);
        if (tileImg?.data) {
            const image = tileImg.data;
            const w = image.width;
            const h = image.height;

            const workingCanvas = this.createCanvas(w, h);
            if (!workingCanvas) {
                throw new Error("Unable to create 2d canvas");
            }
            const workingContext = workingCanvas.getContext("2d");
            if (!workingContext) {
                throw new Error("Unable to get 2d context");
            }

            workingContext.clearRect(0, 0, w, h);
            workingContext.drawImage(image, 0, 0);
            const imgData = workingContext.getImageData(0, 0, w, h);

            const pixels = imgData?.data;
            if (!pixels) {
                throw new Error("Unable to get image data from context");
            }
            const n = pixels.length / (w * h);
            const stride = w * n;

            const size = w * h;
            const demData = new Float32Array(size);
            let min = Number.MAX_SAFE_INTEGER;
            let max = Number.MIN_SAFE_INTEGER;

            // initialize mean value
            let z = this.pixelDecoder.decode(pixels, 0, n);
            demData[0] = z;
            let mean = -z / size;
            // loop the rows
            for (let row = 0; row != h; row++) {
                const offset = stride * row;
                // then columns
                for (let column = 0; column != w; column++) {
                    z = this.pixelDecoder.decode(pixels, offset + column * n, n);
                    demData[offset + column] = z;
                    min = Math.min(z, min);
                    max = Math.max(z, max);
                    mean += z / size;
                }
            }

            const tile = new DEMTile(demData, new DEMMetrics(min, max, mean));
            return tile;
        }
        return null;
    }

    protected createCanvas(width: number, height: number): HTMLCanvasElement | undefined {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
}

export class MapzenRgbValueDecoder implements IRgbValueDecoder {
    public static Shared = new MapzenRgbValueDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, size: number): number {
        if (size < 3) {
            return 0;
        }
        return pixels[offset] * 256 + pixels[offset + 1] + pixels[offset + 2] / 256 - 32768;
    }
}

export class CommonRgbValueDecoder implements IRgbValueDecoder {
    public static Shared = new CommonRgbValueDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, size: number): number {
        if (size < 3) {
            return 0;
        }
        return -10000.0 + (pixels[offset] * 65536 + pixels[offset + 1] * 256 + pixels[offset + 2]) * 0.1;
    }
}
