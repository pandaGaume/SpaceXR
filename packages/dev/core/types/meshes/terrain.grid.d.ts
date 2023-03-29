import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";
export declare class TerrainGridOptions {
    static DefaultGridSize: number;
    static DefaultInvertIndices: boolean;
    static DefaultGenerateUvs: boolean;
    static Shared: TerrainGridOptions;
    static Default(): TerrainGridOptions;
    width: number;
    height?: number;
    invertIndices: boolean;
    generateUvs: boolean;
    constructor(size?: number, height?: number);
    clone(): TerrainGridOptions;
}
export declare class TerrainGridBuilder implements IVerticesDataBuilder {
    private _o?;
    constructor(options?: Nullable<TerrainGridOptions>);
    withOptions(options: Nullable<TerrainGridOptions>): TerrainGridBuilder;
    build(data: IVerticesData): IVerticesData;
}
