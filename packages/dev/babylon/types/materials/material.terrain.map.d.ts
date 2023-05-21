import { ShaderMaterial, Scene } from "@babylonjs/core";
import { WireframeMaterialOptions } from "./material.wireframe";
export declare class MapMaterialOptions {
    wireframe?: WireframeMaterialOptions;
}
export declare class MapMaterial extends ShaderMaterial {
    static MapKeyword: string;
    private static ShaderOptions;
    constructor(name: string, scene: Scene);
}
