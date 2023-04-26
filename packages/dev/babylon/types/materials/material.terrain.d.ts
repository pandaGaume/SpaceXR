import { ShaderMaterial, Scene } from "@babylonjs/core";
import { Ellipsoid } from "@dev/core/src/geography/geodesy/geodesy.ellipsoid";
export declare class TerrainMaterialOptions {
    ellipsoid?: Ellipsoid;
}
export declare class TerrainMaterial extends ShaderMaterial {
    static TerrainKeyword: string;
    private static ShaderOptions;
    constructor(name: string, scene: Scene);
}
