import { IDemInfos } from "./dem.interfaces";
import { Nullable } from "../types";
import { ICartesian3 } from "../geometry/geometry.interfaces";
export declare class DemInfos implements IDemInfos {
    private static GetVector;
    _max: ICartesian3;
    _min: ICartesian3;
    _delta: number;
    _mean: number;
    _elevations: Nullable<Float32Array>;
    _normals: Nullable<Uint8ClampedArray>;
    constructor(elevations: Nullable<Float32Array>, normals?: Nullable<Uint8ClampedArray>, stride?: number);
    get max(): ICartesian3;
    get min(): ICartesian3;
    get delta(): number;
    get mean(): number;
    get elevations(): Nullable<Float32Array>;
    get normals(): Nullable<Uint8ClampedArray>;
    toString(): string;
}
