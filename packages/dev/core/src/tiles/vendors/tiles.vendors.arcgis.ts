import { IUrlBuilder } from "../../io";
import { ITile2DAddress } from "../tiles.interfaces";
import { IPixelDecoder } from "../codecs/tiles.codecs.interfaces";

/**
 * URL builder for ArcGIS ImageServer `exportImage` API.
 *
 * Converts tile XYZ addresses to bbox-based URLs using the Web Mercator projection (EPSG:3857).
 * The bbox is computed from tile coordinates:
 *   tileSpan = 2 * PI * R / 2^z
 *   xmin = -PI * R + x * tileSpan
 *   ymax =  PI * R - y * tileSpan
 *   xmax = xmin + tileSpan
 *   ymin = ymax - tileSpan
 *
 * Example URL:
 *   https://trek.nasa.gov/.../ImageServer/exportImage?bbox=-20037508,-20037508,20037508,20037508
 *     &bboxSR=3857&imageSR=3857&size=256,256&format=png&f=image
 */
export class ArcGISImageServerUrlBuilder implements IUrlBuilder<ITile2DAddress> {
    private readonly _baseUrl: string;
    private readonly _semiMajorAxis: number;
    private readonly _tileSize: number;
    private readonly _format: string;

    /**
     * @param baseUrl The ArcGIS ImageServer exportImage endpoint URL
     *                (e.g. "https://trek.nasa.gov/.../ImageServer/exportImage")
     * @param semiMajorAxis The semi-major axis of the body's ellipsoid in meters.
     *                      Used for Web Mercator extent calculation.
     * @param tileSize Tile pixel size (default 256)
     * @param format Image format (default "png")
     */
    public constructor(baseUrl: string, semiMajorAxis: number, tileSize: number = 256, format: string = "png") {
        this._baseUrl = baseUrl;
        this._semiMajorAxis = semiMajorAxis;
        this._tileSize = tileSize;
        this._format = format;
    }

    public buildUrl(a: ITile2DAddress, ...params: unknown[]): string {
        const R = this._semiMajorAxis;
        const extent = Math.PI * R; // half the full Web Mercator extent
        const tileSpan = (2 * extent) / (1 << a.levelOfDetail);

        const xmin = -extent + a.x * tileSpan;
        const ymax = extent - a.y * tileSpan;
        const xmax = xmin + tileSpan;
        const ymin = ymax - tileSpan;

        return (
            `${this._baseUrl}?bbox=${xmin},${ymin},${xmax},${ymax}` +
            `&bboxSR=3857&imageSR=3857` +
            `&size=${this._tileSize},${this._tileSize}` +
            `&format=${this._format}` +
            `&f=image`
        );
    }
}

/**
 * Decodes ArcGIS ImageServer grayscale elevation PNG tiles to Float32Array.
 *
 * ArcGIS ImageServer renders elevation data as 8-bit grayscale PNG images
 * where pixel values are linearly stretched from the elevation range [min, max]
 * to the grayscale range [0, 255].
 *
 * Decoding formula: elevation = min + (gray / 255) * (max - min)
 *
 * This is a lossy representation — with only 256 distinct values, the precision
 * is (max - min) / 255 meters per step.
 */
export class ArcGISGrayscaleElevationDecoder implements IPixelDecoder<Float32Array> {
    private readonly _min: number;
    private readonly _range: number; // max - min

    /**
     * @param min Minimum elevation in meters (maps to grayscale 0)
     * @param max Maximum elevation in meters (maps to grayscale 255)
     */
    public constructor(min: number, max: number) {
        this._min = min;
        this._range = max - min;
    }

    public decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number {
        // ArcGIS grayscale PNG: R=G=B=gray, A=255
        // We use the red channel as the grayscale value
        const gray = pixels[offset];
        target[targetOffset++] = this._min + (gray / 255) * this._range;
        return targetOffset;
    }
}
