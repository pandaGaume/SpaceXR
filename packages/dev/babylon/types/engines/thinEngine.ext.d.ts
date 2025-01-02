import { InternalTexture, Nullable, ThinEngine } from "@babylonjs/core";
declare module "@babylonjs/core/Engines/thinEngine" {
    interface ThinEngine {
        __SpaceXR__updateSubRawTexture2DArray(texture: InternalTexture, level: number, xoffset: number, yoffset: number, zoffset: number, width: number, height: number, depth: number, data: Nullable<ArrayBufferView> | TexImageSource, format: number, textureType: number): void;
        __SpaceXR__createRawTexture2DArray(width: number, height: number, depth: number, format: number, samplingMode: number, textureType: number, internalFormat?: number): InternalTexture;
        __SpaceXR__copyRawTexture2DArray(oldTexture: InternalTexture, newTexture: InternalTexture): void;
    }
}
export declare function _makeUpdateSubRawTexture2DArrayFunction(is3D: boolean): (this: ThinEngine, texture: InternalTexture, level: number, xoffset: number, yoffset: number, zoffset: number, width: number, height: number, depth: number, data: Nullable<ArrayBufferView> | TexImageSource, format?: number, textureType?: number) => void;
export declare function _makeCreateRawTextureFunction(is3D: boolean): (this: ThinEngine, width: number, height: number, depth: number, format: number, samplingMode: number, textureType?: number, internalFormat?: number) => InternalTexture;
export declare function _makeCopyRawTextureFunction(): (this: ThinEngine, oldTexture: InternalTexture, newTexture: InternalTexture) => void;
