import { ShaderMaterial, Scene } from "@babylonjs/core";
import { GridMaterial } from "spacegx/materials/materials.grid";

export class TerrainMaterial extends ShaderMaterial {
    public fragmentShader: string;

    public constructor(name: string, scene: Scene) {
        super(name, scene, "./shaders/terrain");
        this.fragmentShader = GridMaterial.Shaders.fragment;
    }
}
