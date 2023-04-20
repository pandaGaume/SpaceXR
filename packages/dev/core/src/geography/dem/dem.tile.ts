import { IRgbValueDecoder, ITileAddress } from "shelly/src/tiles/tiles.interfaces";
import { Tile } from "shelly/src/tiles/tiles.tile";
import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";

export class DEMTile extends Tile<Float32Array> {
    /**
     * Internal function to prepare lookup table. The step will be (toDeg - fromDeg) / (count - 1)
     * @param fromDeg where to start the table
     * @param toDeg where to stop the table
     * @param count the number of item.
     * @param ellipsoid optional ellipsoid. If provided, then a third parameter is added which is
     *              N = ellipsoid._a / Math.sqrt(1.0 - ellipsoid._ee * sin * sin)
     * which is an intermediate value into ECEF tranformation.
     * @returns an array of 2xfloat32 or 3xfloat32
     */
    public static _PrepareLookupTable(fromDeg: number, toDeg: number, count: number, ellipsoid?: Ellipsoid) {
        const DE2RA = Math.PI / 180;
        const tbl = new Float32Array(count * (ellipsoid ? 3 : 2));
        const da = (toDeg - fromDeg) / (count - 1);
        let j = 0;
        for (let i = 0; i < count; i++) {
            const a_deg = fromDeg + i * da;
            const a = a_deg * DE2RA;
            const sin = Math.sin(a);
            tbl[j++] = sin;
            tbl[j++] = Math.cos(a);
            if (ellipsoid) {
                tbl[j++] = ellipsoid._a / Math.sqrt(1.0 - ellipsoid._ee * sin * sin);
            }
        }
        return tbl;
    }

    _normals?: Float32Array;
    _latLookupTable?: Float32Array;
    _lonLookupTable?: Float32Array;

    public constructor(data: Float32Array, address?: ITileAddress) {
        super(data, address);
    }

    public get normals(): Float32Array | undefined {
        return this._normals;
    }

    public set normals(n: Float32Array | undefined) {
        this._normals = n;
    }

    public get latitudeLookupTable(): Float32Array | undefined {
        return this._latLookupTable;
    }

    public set latitudeLookupTable(n: Float32Array | undefined) {
        this._latLookupTable = n;
    }

    public get longitudeLookupTable(): Float32Array | undefined {
        return this._lonLookupTable;
    }

    public set longitudeLookupTable(n: Float32Array | undefined) {
        this._lonLookupTable = n;
    }
}

export class CommonRgbValueDecoder implements IRgbValueDecoder<number> {
    public static Shared = new CommonRgbValueDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, size: number): number {
        if (size < 3) {
            return 0;
        }
        return -10000.0 + (pixels[offset] * 65536 + pixels[offset + 1] * 256 + pixels[offset + 2]) * 0.1;
    }
}
