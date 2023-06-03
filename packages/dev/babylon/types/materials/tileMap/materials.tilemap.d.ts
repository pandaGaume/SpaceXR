import { MaterialDefines, Scene, ShaderMaterial, Vector3 } from "@babylonjs/core";
export declare class TileMapMaterialDefines extends MaterialDefines {
}
export declare class TileMapMaterialOptions {
    tileSize?: Vector3;
    cellSize?: Vector3;
}
export declare class TileMapMaterial extends ShaderMaterial {
    static ShaderName: string;
    static Name: string;
    _tileSize: Vector3 | undefined;
    _cellSize: Vector3 | undefined;
    constructor(name: string, options: TileMapMaterialOptions, scene: Scene);
    get tileSize(): Vector3 | undefined;
    set tileSize(v: Vector3 | undefined);
    get cellSize(): Vector3 | undefined;
    set cellSize(v: Vector3 | undefined);
}
