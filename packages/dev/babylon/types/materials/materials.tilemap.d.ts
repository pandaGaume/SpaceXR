import { MaterialDefines, Scene, ShaderMaterial, Vector3 } from "@babylonjs/core";
export declare class TileMapMaterialDefines extends MaterialDefines {
}
export declare class TileMapMaterialOptions {
}
export declare class TileMapMaterial extends ShaderMaterial {
    static ShaderName: string;
    static Name: string;
    constructor(name: string, options: TileMapMaterialOptions, scene: Scene);
    set lightPosition(v: Vector3);
    set terrainColor(v: Vector3);
}
