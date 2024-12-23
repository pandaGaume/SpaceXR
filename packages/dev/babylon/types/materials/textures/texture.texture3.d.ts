import { BaseTexture, ISize, Nullable, Scene, ThinEngine } from "@babylonjs/core";
export interface ITexture3Layer {
    host?: ITexture3;
    depth: number;
    update(data: Nullable<ArrayBufferView> | TexImageSource, row: number, column: number, width?: number, height?: number): void;
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
}
export interface ITexture3 extends ISize {
    depth: number;
    count: number;
    update(depth: number, data: Nullable<ArrayBufferView> | TexImageSource, row: number, column: number, width?: number, height?: number): void;
    release(depth: number): void;
    reserve(): ITexture3Layer | undefined;
}
export declare class Texture3 extends BaseTexture implements ITexture3 {
    _w: number;
    _h: number;
    _count: number;
    _layers: Array<Nullable<ITexture3Layer>>;
    constructor(sceneOrEngine: Nullable<Scene | ThinEngine>, width: number | ITexture3CreationOptions, height?: number, depth?: number, format?: number, textureType?: number, internalFormat?: number, generateMipmaps?: boolean, samplingMode?: number);
    get width(): number;
    get height(): number;
    get depth(): number;
    get count(): number;
    reserve(): ITexture3Layer | undefined;
    update(depth: number, data: Nullable<ArrayBufferView> | TexImageSource, row?: number, column?: number, width?: number, height?: number): void;
    release(depth: number): void;
    protected _buildLayer(z: number): ITexture3Layer;
}
