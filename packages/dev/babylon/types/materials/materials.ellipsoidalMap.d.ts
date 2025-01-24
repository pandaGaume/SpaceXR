import { Scene } from "@babylonjs/core";
import { Map3dMaterial } from "./materials.map";
import { ImageLayerContentType } from "core/tiles";
export declare class EllipsoidalMapMaterial<T extends ImageLayerContentType> extends Map3dMaterial<T> {
    static ClassName: string;
    static ShaderName: string;
    constructor(name: string, scene: Scene);
    getClassName(): string;
}
