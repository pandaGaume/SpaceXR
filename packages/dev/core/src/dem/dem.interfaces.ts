import { ICartesian2, ICartesian3, ISize2 } from "../geometry/geometry.interfaces";
import { Nullable } from "../types";

export interface IDemInfos {
    max: ICartesian3;
    min: ICartesian3;
    delta: number;
    mean: number;

    elevations: Nullable<Float32Array>;
    normals: Nullable<Uint8ClampedArray | HTMLImageElement>;

    toString(): string;
    getDemInfoView(pos: ICartesian2, size: ISize2): IDemInfos;
}
