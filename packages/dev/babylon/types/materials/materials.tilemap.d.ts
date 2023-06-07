import { MaterialDefines, RawTexture2DArray, Scene, ShaderMaterial } from "@babylonjs/core";
export declare class TileMapMaterialDefines extends MaterialDefines {
}
export declare class TileMapMaterialOptions {
    constructor(p: Partial<TileMapMaterialOptions>);
}
export declare class TileMapMaterial extends ShaderMaterial {
    static ShaderName: string;
    static Name: string;
    elevationTexture?: RawTexture2DArray;
    normalTexture?: RawTexture2DArray;
    _o: TileMapMaterialOptions;
    constructor(name: string, options: TileMapMaterialOptions, scene: Scene);
}
