import { InternalTexture, Nullable } from "@babylonjs/core";
declare module "@babylonjs/core/Engines/thinEngine" {
    interface ThinEngine {
        __SpaceXR__updateSubRawTexture2DArray(texture: InternalTexture, level: number, xoffset: number, yoffset: number, zoffset: number, width: number, height: number, depth: number, data: Nullable<ArrayBufferView> | TexImageSource, format: number, textureType: number): void;
        __SpaceXR__createRawTexture2DArray(width: number, height: number, depth: number, format: number, samplingMode: number, textureType: number, internalFormat?: number): InternalTexture;
    }
}
