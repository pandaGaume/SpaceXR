import { ShaderMaterial, Scene } from "@babylonjs/core";

export class TerrainMaterial extends ShaderMaterial {
    constructor(name: string, scene: Scene) {
        super(name, scene, "./shaders/terrain");
    }
}
