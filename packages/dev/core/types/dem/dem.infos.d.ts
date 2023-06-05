import { IDemInfos } from "./dem.interfaces";
import { Nullable } from "../types";
export declare class DemInfos implements IDemInfos {
    _max: number;
    _min: number;
    _mean: number;
    _elevations: Nullable<Float32Array>;
    _normals: Nullable<Float32Array>;
    constructor(elevations: Nullable<Float32Array>, normals?: Nullable<Float32Array>);
    get max(): number;
    get min(): number;
    get mean(): number;
    get elevations(): Nullable<Float32Array>;
    get normals(): Nullable<Float32Array>;
    toString(): string;
}
