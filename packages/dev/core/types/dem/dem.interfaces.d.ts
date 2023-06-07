import { ICartesian3 } from "../geometry/geometry.interfaces";
import { Nullable } from "../types";
export interface IDemInfos {
    max: ICartesian3;
    min: ICartesian3;
    delta: number;
    mean: number;
    elevations: Nullable<Float32Array>;
    normals: Nullable<Uint8ClampedArray>;
    toString(): string;
}
