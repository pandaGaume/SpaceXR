import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";
export declare enum GridCoordinateReference {
    center = 0,
    upperLeft = 1
}
export declare class TerrainGridOptions {
    static Shared: TerrainGridOptions;
    static DefaultGridSize: number;
    static DefaultInvertIndices: boolean;
    static DefaultCoordinateReference: GridCoordinateReference;
    width: number;
    height?: number;
    invertIndices: boolean;
    coordinateReference: GridCoordinateReference;
    constructor(size?: number, height?: number, ref?: GridCoordinateReference);
    clone(): TerrainGridOptions;
}
export declare class TerrainNormalizedGridBuilder implements IVerticesDataBuilder {
    private _o?;
    constructor(options?: Nullable<TerrainGridOptions>);
    withOptions(options: Nullable<TerrainGridOptions>): TerrainNormalizedGridBuilder;
    build<T extends IVerticesData>(data?: T): T;
}
