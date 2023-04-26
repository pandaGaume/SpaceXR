import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";
export declare class TerrainGridOptions {
    static Shared: TerrainGridOptions;
    static DefaultGridSize: number;
    static DefaultInvertIndices: boolean;
    width: number;
    height?: number;
    invertIndices: boolean;
    constructor(size?: number, height?: number);
    clone(): TerrainGridOptions;
}
export declare class TerrainNormalizedGridBuilder implements IVerticesDataBuilder {
    private _o?;
    constructor(options?: Nullable<TerrainGridOptions>);
    withOptions(options: Nullable<TerrainGridOptions>): TerrainNormalizedGridBuilder;
    build(data?: IVerticesData): IVerticesData;
}
