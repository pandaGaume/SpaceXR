import { IDemInfos } from "./dem.interfaces";
import { Nullable } from "../types";
import { Cartesian3 } from "../geometry/geometry.cartesian";
import { ICartesian3 } from "../geometry/geometry.interfaces";

export class DemInfos implements IDemInfos {
    private static GetVector(z: number, i: number, stride: number): ICartesian3 {
        const y = Math.floor(i / stride);
        const x = i - y * stride;
        return new Cartesian3(x, y, z);
    }
    _max: ICartesian3 = Cartesian3.Zero();
    _min: ICartesian3 = Cartesian3.Zero();
    _delta: number = 0;
    _mean: number = 0;
    _elevations: Nullable<Float32Array> = null;
    _normals: Nullable<Uint8ClampedArray> = null;

    public constructor(elevations: Nullable<Float32Array>, normals: Nullable<Uint8ClampedArray> = null, stride?: number) {
        this._elevations = elevations;
        this._normals = normals;

        if (this._elevations) {
            const size = this._elevations?.length;
            stride = stride || Math.sqrt(size);
            let min = Number.MAX_SAFE_INTEGER;
            let max = Number.MIN_SAFE_INTEGER;
            let mean = -this._elevations[0] / size;
            let mini = 0;
            let maxi = 0;
            for (let i = 0; i != size; i++) {
                const z = this._elevations[i];
                if (z < min) {
                    min = z;
                    mini = i;
                } else if (z > max) {
                    max = z;
                    maxi = i;
                }
                mean += z / size;
            }

            this._max = DemInfos.GetVector(max, maxi, stride);
            this._min = DemInfos.GetVector(min, mini, stride);
            this._delta = this._max.z - this._min.z;
            this._mean = mean;
        }
    }

    public get max(): ICartesian3 {
        return this._max;
    }
    public get min(): ICartesian3 {
        return this._min;
    }
    public get delta(): number {
        return this._delta;
    }
    public get mean(): number {
        return this._mean;
    }

    public get elevations(): Nullable<Float32Array> {
        return this._elevations;
    }
    public get normals(): Nullable<Uint8ClampedArray> {
        return this._normals;
    }

    public toString(): string {
        return `elevations count:${this._elevations?.length || 0}, min:{${this._min.toString()}}, max:{${this._max.toString()}}, delta:${this._delta}, mean:${
            this._mean
        },normals count:${this._normals?.length || 0}`;
    }
}
