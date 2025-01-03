import { ICartesian2, ICartesian3, ISize2 } from "../geometry/geometry.interfaces";
import { Nullable } from "../types";

export function IsDemInfos(b: unknown): b is IDemInfos {
    if (typeof b !== "object" || b === null) return false;
    return (<IDemInfos>b).getDemInfoView !== undefined;
}

export interface IDemInfos {
    max: ICartesian3;
    min: ICartesian3;
    delta: number;
    mean: number;

    elevations: Nullable<Float32Array>;
    normals: Nullable<Uint8ClampedArray>;

    toString(): string;
    getDemInfoView(pos: ICartesian2, size: ISize2): IDemInfos;
}
