import { ShaderMaterial, Scene } from "@babylonjs/core";
import { Ellipsoid } from "@dev/core/src/geography/geodesy/geodesy.ellipsoid";
import { WireframeMaterialOptions } from "./material.wireframe";
export declare class TerrainMaterialOptions {
    wireframe?: WireframeMaterialOptions;
    ellipsoid?: Ellipsoid;
}
export declare class TerrainMaterial extends ShaderMaterial {
    static TerrainKeyword: string;
    private static ShaderOptions;
    constructor(name: string, scene: Scene);
}
