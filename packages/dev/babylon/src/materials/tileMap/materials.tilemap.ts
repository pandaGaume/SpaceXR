import { MaterialDefines, Scene, ShaderMaterial, Vector3 } from "@babylonjs/core";

export class TileMapMaterialDefines extends MaterialDefines {}

export class TileMapMaterialOptions{
    tileSize?: Vector3 ;
    cellSize?: Vector3 ;

}

export class TileMapMaterial extends ShaderMaterial {
    static ShaderName = "tilemap";
    static Name = `${TileMapMaterial.ShaderName}.material`;

    _tileSize: Vector3 | undefined;
    _cellSize: Vector3 | undefined;

    public constructor(name: string, options: TileMapMaterialOptions, scene: Scene) {
        super(
            name,
            scene,
            { vertex: TileMapMaterial.ShaderName, fragment: TileMapMaterial.ShaderName },
            {
                attributes: ["position", "normal"],
                uniforms: ["worldViewProjection", "world", "lightPosition", "tileSize", "cellSize", "terrainColor"],
            }
        );
    }

    public get tileSize(): Vector3 | undefined {
        return this._tileSize;
    }

    public set tileSize(v: Vector3 | undefined) {
        this._tileSize = v;
        this.setVector3("tileSize", v || Vector3.One());
    }

    public get cellSize(): Vector3 | undefined {
        return this._cellSize;
    }

    public set cellSize(v: Vector3 | undefined) {
        this._tileSize = v;
        this.setVector3("cellSize", v || Vector3.One());
    }
}
