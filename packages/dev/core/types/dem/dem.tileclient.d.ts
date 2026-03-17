import { Nullable } from "../types";
import { ITile2DAddress, ITileClient, ITileMetrics } from "../tiles/tiles.interfaces";
import { IDemInfos } from "./dem.interfaces";
import { IGeoBounded } from "../geography";
import { FetchResult } from "../io";
export declare class DemTileWebClient implements ITileClient<IDemInfos> {
    _name: string;
    _zindex: number;
    _elevationsDataSource: ITileClient<Float32Array>;
    _normalsDataSource?: ITileClient<Uint8ClampedArray | HTMLImageElement>;
    constructor(name: string, elevationSrc: ITileClient<Float32Array>, normalSrc?: ITileClient<Uint8ClampedArray | HTMLImageElement>);
    get name(): string;
    get zindex(): number;
    set zindex(v: number);
    get metrics(): ITileMetrics | undefined;
    fetchAsync(request: ITile2DAddress, env?: IGeoBounded, ...userArgs: unknown[]): Promise<FetchResult<ITile2DAddress, Nullable<IDemInfos>>>;
    /**
     * We uses a technique called "normal encoding" to represent normal vectors in its images.
     * This technique involves encoding normal vectors using the three color channels of the image (red, green, and blue).
     * To achieve this, each component of the normalized normal vector (x, y, z) is transformed into an 8-bit value in the range [0, 255] using an affine transformation.
     * Note: An affine transformation is a geometric transformation that preserves parallelism of lines and distance ratios.
     *
     * Specifically, the value of each color channel is calculated using the following formulas:
     *       R = (x + 1) / 2 * 255
     *       G = (y + 1) / 2 * 255
     *       B = z * 127 + 128
     *
     * The z component is transformed into a value in the range [0, 255] using translation and scaling.
     * The x component is scaled and shifted to be in the range [0, 1] before being multiplied by 255 and rounded to the nearest integer.
     * The y component is treated similarly.
     * Using this technique, normal vectors can be represented in the image with a precision of 1/255 in each direction.
     *
     * To calculate the normal vector (x, y, z) from the color channel values R, G, B,
     * it is necessary to perform the inverse operations of the transformations applied during encoding.
     * Specifically, to retrieve the values of x, y, and z from the values of R, G, and B, the following formulas are used:
     *      x = (2 * R / 255) - 1
     *      y = (2 * G / 255) - 1
     *      z = (B - 128) / 127
     *
     * These formulas are derived by performing the inverse operations of those used to encode the normal vector.
     * The value of z is decoded first using translation and scaling, and then the values of x and y
     * are decoded by reversing the affine transformation applied to each component.
     * Note that the precision of the decoded x, y, and z values is limited by the precision of the encoded R, G, and B values, which is 8 bits per color channel.
     * This means that the obtained values of x, y, and z may be approximated with a precision of 1/255.
     */
    private computeNormals;
    private getNormalsWindows;
}
