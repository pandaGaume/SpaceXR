import { InternalTexture, Nullable, Scene, Texture } from "@babylonjs/core";
import { ITileMetrics } from "../..";
declare module "@babylonjs/core/Engines/thinEngine" {
    interface ThinEngine {
        __SpaceXR___updateSubRawTexture2DArray(texture: InternalTexture, level: number, xoffset: number, yoffset: number, zoffset: number, width: number, height: number, depth: number, data: TilePoolData, format: number, textureType: number): void;
        __SpaceXR___createRawTexture2DArray(width: number, height: number, depth: number, format: number, samplingMode: number, textureType: number, internalFormat?: number): InternalTexture;
    }
}
export type TilePoolData = Nullable<ArrayBufferView> | TexImageSource;
export interface ITilePoolTextureArea {
    id: number;
    update(data: TilePoolData): void;
    release(): void;
}
export interface ITilePoolTexture {
    areaCount: number;
    freeAreaCount: number;
    usedAreaCount: number;
    reserveArea(): Nullable<TilePoolTextureArea>;
}
export declare class TilePoolTextureOptions {
    static Default: TilePoolTextureOptions;
    data: TilePoolData;
    metrics: ITileMetrics;
    count: number;
    format: number;
    textureType: number;
    internalFormat?: number;
    generateMipmap: boolean;
    samplingMode: number;
    constructor(p?: Partial<TilePoolTextureOptions>);
}
declare class TilePoolTextureArea implements ITilePoolTextureArea {
    _owner: TilePoolTexture;
    _id: number;
    private _released;
    constructor(owner: TilePoolTexture, id: number);
    update(data: TilePoolData): void;
    release(): void;
    get id(): number;
}
export declare class TilePoolTexture extends Texture implements ITilePoolTexture {
    _o: TilePoolTextureOptions;
    _areas: Array<Nullable<TilePoolTextureArea>>;
    _used: number;
    constructor(name: string, options: TilePoolTextureOptions, scene: Scene);
    reserveArea(): Nullable<TilePoolTextureArea>;
    get areaCount(): number;
    get freeAreaCount(): number;
    get usedAreaCount(): number;
    _releaseArea(i: number): void;
    _updateArea(i: number, data: TilePoolData): void;
}
export {};
