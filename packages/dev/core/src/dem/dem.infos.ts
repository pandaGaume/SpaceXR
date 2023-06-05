import { IDemInfos } from "./dem.interfaces";
import { Nullable } from "../types";

export class DemInfos implements IDemInfos {
    _max: number = 0;
    _min: number = 0;
    _mean: number = 0;
    _elevations: Nullable<Float32Array> = null;
    _normals: Nullable<Float32Array> = null;

    public constructor(elevations: Nullable<Float32Array>, normals: Nullable<Float32Array> = null) {
        this._elevations = elevations;
        this._normals = normals;

        if (this._elevations) {
            const size = this._elevations?.length;
            let min = Number.MAX_SAFE_INTEGER;
            let max = Number.MIN_SAFE_INTEGER;
            let mean = -this._elevations[0] / size;
            for (let i = 0; i != size; i++) {
                const z = this._elevations[i];
                min = Math.min(z, min);
                max = Math.max(z, max);
                mean += z / size;
            }
            this._max = max;
            this._min = min;
            this._mean = mean;
        }
    }

    public get max(): number {
        return this._max;
    }
    public get min(): number {
        return this._min;
    }
    public get mean(): number {
        return this._mean;
    }

    public get elevations(): Nullable<Float32Array> {
        return this._elevations;
    }
    public get normals(): Nullable<Float32Array> {
        return this._normals;
    }

    public toString(): string {
        return `elevations count:${this._elevations?.length || 0}, min:${this._min}, max:${this._max}, mean:${this._mean},normals count:${this._normals?.length || 0}`;
    }
}
