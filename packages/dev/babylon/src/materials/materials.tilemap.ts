import { MaterialDefines, RawTexture2DArray, Scene, ShaderMaterial } from "@babylonjs/core";

export class TileMapMaterialDefines extends MaterialDefines {}

export class TileMapMaterialOptions {
    public constructor(p: Partial<TileMapMaterialOptions>) {
        Object.assign(this, p);
    }
}

export class TileMapMaterial extends ShaderMaterial {
    static ShaderName = "tilemap";
    static Name = `${TileMapMaterial.ShaderName}.material`;

    elevationTexture?: RawTexture2DArray;
    normalTexture?: RawTexture2DArray;

    _o: TileMapMaterialOptions;

    public constructor(name: string, options: TileMapMaterialOptions, scene: Scene) {
        const shaderOptions = {
            attributes: ["position", "normal"],
            uniforms: ["world", "viewProjection", "light", "material", "northClip", "southClip", "westClip", "eastClip"],
        };

        super(name, scene, { vertex: TileMapMaterial.ShaderName, fragment: TileMapMaterial.ShaderName }, shaderOptions);
        this._o = options;
    }
}
