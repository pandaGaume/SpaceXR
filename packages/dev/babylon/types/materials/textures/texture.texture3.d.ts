import { BaseTexture, ISize, Nullable, Scene, ThinEngine } from "@babylonjs/core";
export interface ITexture3Layer {
    host?: ITexture3;
    depth: number;
    update(data: Nullable<ArrayBufferView> | TexImageSource, row?: number, column?: number, width?: number, height?: number): void;
    release(): void;
}
export interface ITexture3CreationOptions {
    width: number;
    height?: number;
    depth: number;
    format?: number;
    textureType?: number;
    internalFormat?: number;
    generateMipmap?: boolean;
    samplingMode?: number;
    wrapU?: number;
    wrapV?: number;
}
export interface ITexture3 extends ISize {
    depth: number;
    count: number;
    update(depth: number, data: Nullable<ArrayBufferView> | TexImageSource, row?: number, column?: number, width?: number, height?: number): void;
    release(depth: number): void;
    reserve(): ITexture3Layer | undefined;
    ensureRoomFor(count: number): boolean;
}
export declare class Texture3 extends BaseTexture implements ITexture3 {
    _w: number;
    _h: number;
    _count: number;
    _layers: Array<Nullable<ITexture3Layer>>;
    _internalFormat?: number;
    constructor(sceneOrEngine: Nullable<Scene | ThinEngine>, width: number | ITexture3CreationOptions, height?: number, depth?: number, format?: number, textureType?: number, internalFormat?: number, generateMipmaps?: boolean, samplingMode?: number, wrapU?: number, wrapV?: number);
    get width(): number;
    get height(): number;
    get depth(): number;
    get count(): number;
    reserve(): ITexture3Layer | undefined;
    update(depth: number, data: Nullable<ArrayBufferView> | TexImageSource, row?: number, column?: number, width?: number, height?: number): void;
    release(depth: number): void;
    ensureRoomFor(count: number): boolean;
    protected _buildLayer(z: number): ITexture3Layer;
}
