import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";
export declare class TerrainGridOptions {
    static DefaultGridSize: number;
    static DefaultInvertIndices: boolean;
    static DefaultInvertYZ: boolean;
    static Shared: TerrainGridOptions;
    width?: number;
    height?: number;
    invertIndices?: boolean;
    invertYZ?: boolean;
    constructor(p: Partial<TerrainGridOptions>);
    clone(): TerrainGridOptions;
}
export declare class TerrainGridOptionsBuilder {
    _width?: number;
    _height?: number;
    _invertIndices?: boolean;
    _invertYZ?: boolean;
    withWidth(v?: number): TerrainGridOptionsBuilder;
    withHeight(v?: number): TerrainGridOptionsBuilder;
    withInvertIndices(v?: boolean): TerrainGridOptionsBuilder;
    withInvertYZ(v?: boolean): TerrainGridOptionsBuilder;
    build(): TerrainGridOptions;
}
export declare class TerrainNormalizedGridBuilder implements IVerticesDataBuilder {
    private _o?;
    constructor(options?: Nullable<TerrainGridOptions>);
    withOptions(options: Nullable<TerrainGridOptions>): TerrainNormalizedGridBuilder;
    build<T extends IVerticesData>(data?: T): T;
}
