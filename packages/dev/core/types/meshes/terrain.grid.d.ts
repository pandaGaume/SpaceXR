import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";
export declare class TerrainGridOptions {
    static DefaultGridSize: number;
    static DefaultInvertIndices: boolean;
    static DefaultScale: number;
    static Shared: TerrainGridOptions;
    uvs?: boolean;
    columns?: number;
    rows?: number;
    sx?: number;
    sy?: number;
    invertIndices?: boolean;
    zInitializer?: (x: number, y: number, ...data: any[]) => number;
    constructor(p: Partial<TerrainGridOptions>);
    clone(): TerrainGridOptions;
}
export declare class TerrainGridOptionsBuilder {
    _uvs?: boolean;
    _cols?: number;
    _rows?: number;
    _sx?: number;
    _sy?: number;
    _invertIndices?: boolean;
    _invertYZ?: boolean;
    _zInitializer?: (x: number, y: number, ...data: any[]) => number;
    withUvs(flag: boolean): TerrainGridOptionsBuilder;
    withColumns(v?: number): TerrainGridOptionsBuilder;
    withRows(v?: number): TerrainGridOptionsBuilder;
    withInvertIndices(v?: boolean): TerrainGridOptionsBuilder;
    withInvertYZ(v?: boolean): TerrainGridOptionsBuilder;
    withScale(x: number, y?: number): TerrainGridOptionsBuilder;
    withZInitializer(zinit: (x: number, y: number, ...data: any[]) => number): TerrainGridOptionsBuilder;
    build(): TerrainGridOptions;
}
export declare class TerrainNormalizedGridBuilder implements IVerticesDataBuilder {
    private _o?;
    constructor(options?: Nullable<TerrainGridOptions>);
    withOptions(options: Nullable<TerrainGridOptions>): TerrainNormalizedGridBuilder;
    build<T extends IVerticesData>(data?: T, ...params: any[]): T;
}
