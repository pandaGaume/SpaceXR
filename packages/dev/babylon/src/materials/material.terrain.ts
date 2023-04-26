import { ShaderMaterial, Scene } from "@babylonjs/core";
import { Ellipsoid } from "@dev/core/src/geography/geodesy/geodesy.ellipsoid";
import { WireframeMaterialOptions } from "./material.wireframe";

export class TerrainMaterialOptions {
    wireframe?: WireframeMaterialOptions;
    ellipsoid?: Ellipsoid;
}

export class TerrainMaterial extends ShaderMaterial {
    public static TerrainKeyword = "terrain";
    private static ShaderOptions = {
        attributes: ["position", "normal"],
        uniforms: ["world", "worldViewProjection", "ellipsoid", "enuTransform", "altitudes", "lightPosition", "color", "latLT", "lonLT"],
    };

    public constructor(name: string, scene: Scene) {
        super(name, scene, { vertex: TerrainMaterial.TerrainKeyword, fragment: TerrainMaterial.TerrainKeyword }, TerrainMaterial.ShaderOptions);
    }
}
