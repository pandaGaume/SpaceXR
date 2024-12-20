import { Scene } from "@babylonjs/core";
import { Map3dMaterial } from "./materials.map";
export declare class EllipsoidalMapMaterial extends Map3dMaterial {
    static ClassName: string;
    static ShaderName: string;
    constructor(name: string, scene: Scene);
}
