import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";
export declare enum TerrainTopology {
    normal = 0,
    star = 1
}
export declare class TerrainGridOptions {
    static DefaultGridSize: number;
    static DefaultInvertIndices: boolean;
    static DefaultGenerateUvs: boolean;
    static DefaultTerrainTopology: TerrainTopology;
    static Shared: TerrainGridOptions;
    static Default(): TerrainGridOptions;
    width: number;
    height?: number;
    invertIndices: boolean;
    topology: TerrainTopology;
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
