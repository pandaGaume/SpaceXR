import { Nullable } from "core/types";
import { ITileMetrics } from "./tiles.interfaces";
import { AbstractTileCruncher } from "./tiles.crunchers";
export declare class Float32ArrayTileCruncher extends AbstractTileCruncher<Float32Array> {
    private _smoothingEnabled;
    constructor(metrics: ITileMetrics);
    get smoothingEnabled(): boolean;
    set smoothingEnabled(value: boolean);
    Downsampling(childs: Float32Array[]): Nullable<Float32Array>;
    Upsampling(parent: Float32Array, sectionIndex: number): Nullable<Float32Array>;
    private _upsampling;
    private _upsamplingBilinear;
    private _bilinearInterpolation;
}
