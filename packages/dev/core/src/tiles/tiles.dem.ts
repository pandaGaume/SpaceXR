import { Ellipsoid } from "../geodesy/geodesy.ellipsoid";
import { Tile } from "./tiles";

export class DEMMetaData {
    public static From(data?: Float32Array): DEMMetaData | undefined {
        if (data) {
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
            return new DEMMetaData(min, max, mean);
        }
        return undefined;
    }

    constructor(public min: number, public max: number, public mean?: number) {}
}

export class DEMTile extends Tile<Float32Array> {
    /**
     * Internal function to prepare lookup table. The step will be (toDeg - fromDeg) / (count - 1)
     * @param fromDeg where to start the table
     * @param toDeg where to stop the table
     * @param count the number of item.
     * @param ellipsoid optional ellipsoid. If provided, then a third parameter is added which is
     * N = ellipsoid._a / Math.sqrt(1.0 - ellipsoid._ee * sin * sin)
     * which is an intermediate value into ECEF tranformation and concerning the latitude ONLY.
     * @returns an array of 2xfloat32 or 3xfloat32
     */
    public static _PrepareLookupTable(fromDeg: number, toDeg: number, count: number, ellipsoid?: Ellipsoid): Float32Array {
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

    _dataMetrics?: DEMMetaData;
    _normals?: Float32Array;
    _latLookupTable?: Float32Array;
    _lonLookupTable?: Float32Array;

    public constructor(x: number, y: number, levelOfDetail: number, data?: Float32Array) {
        super(x, y, levelOfDetail, data);
        this._dataMetrics = DEMMetaData.From(data);
    }

    public get dataMetrics(): DEMMetaData | undefined {
        return this._dataMetrics;
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

    public get longitudeLookupTable(): Float32Array | undefined {
        return this._lonLookupTable;
    }

    public prepareLookupTable(tileSize: number, ellipsoid?: Ellipsoid) {
        const env = this.bounds;
        if (env) {
            this._latLookupTable = DEMTile._PrepareLookupTable(env.north, env.south, tileSize, ellipsoid);
            this._lonLookupTable = DEMTile._PrepareLookupTable(env.west, env.east, tileSize);
        }
    }

    public clearLookupTable() {
        this._latLookupTable = undefined;
        this._lonLookupTable = undefined;
    }
}
