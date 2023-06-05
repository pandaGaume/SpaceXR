import { Nullable } from "../types";

export interface IDemInfos {
    max: number;
    min: number;
    mean: number;

    elevations: Nullable<Float32Array>;
    normals: Nullable<Float32Array>;
}
