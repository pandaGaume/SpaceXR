import { MaterialDefines, Scene, ShaderMaterial, Vector3 } from "@babylonjs/core";

export class TileMapMaterialDefines extends MaterialDefines {}

export class TileMapMaterialOptions {}

export class TileMapMaterial extends ShaderMaterial {
    static ShaderName = "tilemap";
    static Name = `${TileMapMaterial.ShaderName}.material`;

    public constructor(name: string, options: TileMapMaterialOptions, scene: Scene) {
        super(
            name,
            scene,
            { vertex: TileMapMaterial.ShaderName, fragment: TileMapMaterial.ShaderName },
            {
                attributes: ["position", "normal"],
                uniforms: ["worldViewProjection", "world", "lightPosition", "terrainColor"],
            }
        );
    }

    public set lightPosition(v: Vector3) {
        this.setVector3("lightPosition", v);
    }

    public set terrainColor(v: Vector3) {
        this.setVector3("terrainColor", v);
    }
}
