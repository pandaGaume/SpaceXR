import { Nullable } from "../types";
import { FetchResult, ITileAddress, ITileClient, ITileMetrics } from "../tiles/tiles.interfaces";
import { IDemInfos } from "./dem.interfaces";
import { DemInfos } from "./dem.infos";
import { IGeoBounded } from "../geography";

export class DemTileWebClient implements ITileClient<IDemInfos> {
    _name: string;
    _zindex: number = 0;
    _elevationsDataSource: ITileClient<Float32Array>;
    _normalsDataSource?: ITileClient<Uint8ClampedArray | HTMLImageElement>;

    public constructor(name: string, elevationSrc: ITileClient<Float32Array>, normalSrc?: ITileClient<Uint8ClampedArray | HTMLImageElement>) {
        this._name = name;
        this._elevationsDataSource = elevationSrc;
        this._normalsDataSource = normalSrc;
    }

    public get name(): string {
        return this._name;
    }

    public get zindex(): number {
        return this._zindex;
    }

    public set zindex(v: number) {
        this._zindex = v;
    }

    public get metrics(): ITileMetrics {
        return this._elevationsDataSource.metrics;
    }

    public async fetchAsync(request: ITileAddress, env?: IGeoBounded, ...userArgs: unknown[]): Promise<FetchResult<Nullable<IDemInfos>>> {
        const requests: Array<Promise<FetchResult<Nullable<Float32Array> | Nullable<Uint8ClampedArray> | Nullable<HTMLImageElement>>>> = [];
        requests.push(this._elevationsDataSource.fetchAsync(request, env, ...userArgs));
        if (this._normalsDataSource) {
            requests.push(this._normalsDataSource.fetchAsync(request, env, ...userArgs));
        }

        const results = await Promise.allSettled(requests);

        let elevations: Nullable<Float32Array> = null;
        let normals: Nullable<Uint8ClampedArray> = null;

        // elevations
        if (results[0].status == "fulfilled") {
            elevations = <Nullable<Float32Array>>results[0].value.content;
        } else {
            throw new Error(results[0].reason);
        }

        if (elevations == null) {
            return new FetchResult<Nullable<IDemInfos>>(request, null, userArgs);
        }

        // normals
        if (results.length > 1) {
            if (results[1].status == "fulfilled") {
                normals = <Nullable<Uint8ClampedArray>>results[1].value.content;
            }
        }
        if (normals == null) {
            const s = this.metrics.tileSize;
            normals = this.computeNormals(elevations, s, s);
        }

        const result = new FetchResult(request, new DemInfos(elevations, normals), userArgs);
        result.ok = true;
        return result;
    }

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
    private computeNormals(positions: Float32Array, w: number, h: number): Uint8ClampedArray {
        const normals: Uint8ClampedArray = new Uint8ClampedArray(w * h * 3);
        const indices = [0, 3, 6, 15, 24, 21, 18, 9];
        let i = 0;
        for (let row = 0; row < w; row++) {
            for (let col = 0; col < h; col++) {
                let nx = 0;
                let ny = 0;
                let nz = 0;
                let nn = 0;
                const v = this.getNormalsWindows(positions, row, col, w, h);
                let k = indices[0];
                let a1 = v[k++];
                let a2 = v[k++];
                let a3 = v[k];
                for (let i = 1; i < indices.length; i++) {
                    k = indices[i];
                    const b1 = v[k++];
                    const b2 = v[k++];
                    const b3 = v[k];

                    if (a3 !== undefined && b3 !== undefined) {
                        const na = a2 * b3 - a3 * b2;
                        const nb = a3 * b1 - a1 * b3;
                        const nc = a1 * b2 - a2 * b1;
                        nx += na;
                        ny += nb;
                        nz += nc;
                        nn++;
                    }
                    a1 = b1;
                    a2 = b2;
                    a3 = b3;
                }
                const x = nx / nn;
                const y = ny / nn;
                const z = nz / nn;

                const l = Math.sqrt(x * x + y * y + z * z);

                const R = ((x / l + 1) / 2) * 255;
                const G = ((y / l + 1) / 2) * 255;
                const B = (z / l) * 127 + 128;

                normals[i++] = R;
                normals[i++] = G;
                normals[i++] = B;
            }
        }
        return normals;
    }

    private getNormalsWindows(positions: Float32Array, i: number, j: number, w: number, h: number): any[] {
        let index = (i * w + j) * 3;
        const xref = positions[index++];
        const yref = positions[index++];
        const zref = positions[index];

        const windows = new Array(27);
        const startRow = i - 1;
        const endRow = i + 1;
        const startCol = j - 1;
        const endCol = j + 1;
        let k = 0;
        for (let row = startRow; row <= endRow; row++) {
            const offset = row * w;
            for (let col = startCol; col <= endCol; col++) {
                index = (offset + col) * 3;
                let dx = col < 0 ? undefined : col >= w ? undefined : positions[index] - xref;
                let dy = row < 0 ? undefined : row >= h ? undefined : positions[index + 1] - yref;
                let dz = dx === undefined || dy === undefined ? undefined : positions[index + 2] - zref;
                windows[k++] = dx;
                windows[k++] = dy;
                windows[k++] = dz;
            }
        }
        return windows;
    }
}
