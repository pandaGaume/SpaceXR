import { ShaderMaterial, Scene } from "@babylonjs/core";
export declare class TerrainMaterial extends ShaderMaterial {
    fragmentShader: string;
    constructor(name: string, scene: Scene);
}
