import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";
type VInitializerFn = (column: number, row: number, w: number, h: number, ...data: any[]) => number | number[];
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
    ox?: number;
    oy?: number;
    invertIndices?: boolean;
    zInitializer?: VInitializerFn;
    uvInitializer?: VInitializerFn;
    constructor(p: Partial<TerrainGridOptions>);
    clone(): TerrainGridOptions;
}
export declare class TerrainGridOptionsBuilder {
    _uvs?: boolean;
    _cols?: number;
    _rows?: number;
    _sx?: number;
    _sy?: number;
    _ox?: number;
    _oy?: number;
    _invertIndices?: boolean;
    _invertYZ?: boolean;
    _zInitializer?: VInitializerFn;
    _uvInitializer?: VInitializerFn;
    withUvs(flag: boolean): TerrainGridOptionsBuilder;
    withColumns(v?: number): TerrainGridOptionsBuilder;
    withRows(v?: number): TerrainGridOptionsBuilder;
    withInvertIndices(v?: boolean): TerrainGridOptionsBuilder;
    withInvertYZ(v?: boolean): TerrainGridOptionsBuilder;
    withScale(x: number, y?: number): TerrainGridOptionsBuilder;
    withOffset(x: number, y?: number): TerrainGridOptionsBuilder;
    withZInitializer(zinit: VInitializerFn): TerrainGridOptionsBuilder;
    withUVInitializer(uvinit: VInitializerFn): TerrainGridOptionsBuilder;
    build(): TerrainGridOptions;
}
export declare class TerrainNormalizedGridBuilder implements IVerticesDataBuilder {
    private _o?;
    constructor(options?: Nullable<TerrainGridOptions>);
    withOptions(options: Nullable<TerrainGridOptions>): TerrainNormalizedGridBuilder;
    build<T extends IVerticesData>(data?: T, ...params: any[]): T;
}
export {};
