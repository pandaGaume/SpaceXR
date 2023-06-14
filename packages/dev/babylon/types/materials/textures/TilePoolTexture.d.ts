import { InternalTexture, Nullable, Scene, Texture } from "@babylonjs/core";
import { ITileMetrics } from "../..";
declare module "@babylonjs/core/Engines/thinEngine" {
    interface ThinEngine {
        __SpaceXR___updateSubRawTexture2DArray(texture: InternalTexture, level: number, xoffset: number, yoffset: number, zoffset: number, width: number, height: number, depth: number, data: Nullable<ArrayBufferView>, format: number, textureType: number): void;
        __SpaceXR___createRawTexture2DArray(width: number, height: number, depth: number, format: number, samplingMode: number, textureType: number): InternalTexture;
    }
}
export interface ITilePoolTextureArea {
    id: number;
    update(data: Nullable<ArrayBufferView>): void;
    release(): void;
}
export interface ITilePoolTexture {
    areaCount: number;
    freeAreaCount: number;
    usedAreaCount: number;
    reserveArea(): Nullable<ITilePoolTextureArea>;
}
export declare class TilePoolTextureOptions {
    static Default: TilePoolTextureOptions;
    data: Nullable<ArrayBufferView>;
    metrics: ITileMetrics;
    count: number;
    format: number;
    textureType: number;
    generateMipmap: boolean;
    samplingMode: number;
    constructor(p?: Partial<TilePoolTextureOptions>);
}
export declare class TilePoolTexture extends Texture implements ITilePoolTexture {
    _o: TilePoolTextureOptions;
    _areas: Array<Nullable<ITilePoolTextureArea>>;
    _used: number;
    constructor(name: string, options: TilePoolTextureOptions, scene: Scene);
    reserveArea(): Nullable<ITilePoolTextureArea>;
    get areaCount(): number;
    get freeAreaCount(): number;
    get usedAreaCount(): number;
    _releaseArea(i: number): void;
    _updateArea(i: number, data: Nullable<ArrayBufferView>): void;
}
