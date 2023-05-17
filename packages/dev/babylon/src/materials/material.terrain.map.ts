import { ShaderMaterial, Scene } from "@babylonjs/core";
import { WireframeMaterialOptions } from "./material.wireframe";

export class MapMaterialOptions {
    wireframe?: WireframeMaterialOptions;
}

export class MapMaterial extends ShaderMaterial {
    public static MapKeyword = "tilemap";
    private static ShaderOptions = {
        attributes: ["position", "normal"],
        uniforms: ["world", "worldViewProjection", "altitudes", "lightPosition", "color"],
    };

    public constructor(name: string, scene: Scene) {
        super(name, scene, { vertex: MapMaterial.MapKeyword, fragment: MapMaterial.MapKeyword }, MapMaterial.ShaderOptions);
    }
}
