import { MaterialDefines, Scene, ShaderMaterial } from "@babylonjs/core";

export class TileMapMaterialDefines extends MaterialDefines {}

export class TileMapMaterial extends ShaderMaterial {
    static ShaderName = "tilemap";
    static Name = `${TileMapMaterial.ShaderName}.material`;

    public constructor(name: string, scene: Scene) {
        super(
            name,
            scene,
            { vertex: TileMapMaterial.ShaderName, fragment: TileMapMaterial.ShaderName },
            {
                attributes: ["position, normal"],
                uniforms: ["worldViewProjection", "tileSize", "cellSize"],
            }
        );
    }
}
