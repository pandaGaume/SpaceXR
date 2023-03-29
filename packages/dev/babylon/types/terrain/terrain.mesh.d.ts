import { Nullable, Scene, TransformNode } from "@babylonjs/core";
import { IVerticesData } from "spacegx/meshes/meshes.interfaces";
import { TerrainGridOptions } from "spacegx/meshes/terrain.grid";
declare module "@babylonjs/core/meshes/mesh.vertexData" {
    interface VertexData extends IVerticesData {
    }
}
export declare class TerrainTileOptions {
    static DefaultRows: number;
    static DefaultColumns: number;
    static DefaultWidth: number;
    static DefaultHeight: number;
    static DefaultLat: number;
    static DefaultLon: number;
    static Default(rows?: number, columns?: number): TerrainTileOptions;
    lon: number;
    lat: number;
    width: number;
    height: number;
    rows: number;
    columns: number;
}
export declare class TerrainMeshOptions {
    gridOptions?: TerrainGridOptions;
    tileOptions?: TerrainTileOptions;
}
export declare class TerrainMeshOptionsBuilder {
    private _gridOptions?;
    withGridOptions(v?: TerrainGridOptions): TerrainMeshOptionsBuilder;
    build(): TerrainMeshOptions;
}
export declare class TerrainMesh extends TransformNode {
    static TilePrefix: string;
    static Separator: string;
    static GridExtension: string;
    static CenterVariableName: string;
    static SizeVariableName: string;
    private static GenerateGridModel;
    private static GenerateGridInstances;
    private _o;
    private _grid;
    private _instances;
    constructor(name: string, options: TerrainMeshOptions, scene: Nullable<Scene> | undefined);
}
