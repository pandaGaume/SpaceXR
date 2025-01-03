import { IDemInfos } from "./dem.interfaces";
import { Nullable } from "../types";
import { Cartesian3 } from "../geometry/geometry.cartesian";
import { ICartesian3, ICartesian2, ISize2 } from "../geometry/geometry.interfaces";

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
    _normals: Nullable<Uint8ClampedArray > = null;
    _stride: number = 0;

    public constructor(elevations: Nullable<Float32Array>, normals: Nullable<Uint8ClampedArray> = null, stride?: number, pos?: ICartesian2, size?: ISize2) {
        this._elevations = elevations;
        this._normals = normals;

        if (this._elevations) {
            const length = this._elevations?.length;
            this._stride = stride || Math.sqrt(length);
            let min = Number.MAX_SAFE_INTEGER;
            let max = Number.MIN_SAFE_INTEGER;
            let mean = -this._elevations[0] / length;
            let mini = 0;
            let maxi = 0;
            const x0 = pos?.x || 0;
            const x1 = x0 + (size?.width || this._stride);
            const y0 = pos?.y || 0;
            const y1 = y0 + (size?.height || this._stride);

            for (let y = y0; y < y1; y++) {
                const j = y * this._stride;
                for (let x = x0; x < x1; x++) {
                    const i = j + x;
                    const z = this._elevations[i];
                    if (z < min) {
                        min = z;
                        mini = i;
                    } else if (z > max) {
                        max = z;
                        maxi = i;
                    }
                    mean += z / length;
                }
            }

            this._max = DemInfos.GetVector(max, maxi, this._stride);
            this._min = DemInfos.GetVector(min, mini, this._stride);
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
        return `elevations count:${this._elevations?.length || 0}, min:{${this._min.toString()}}, max:{${this._max.toString()}}, delta:${this._delta}, mean:${this._mean}}`;
    }

    public getDemInfoView(pos: ICartesian2, size: ISize2): IDemInfos {
        return new DemInfos(this._elevations, this._normals, this._stride, pos, size);
    }
}
