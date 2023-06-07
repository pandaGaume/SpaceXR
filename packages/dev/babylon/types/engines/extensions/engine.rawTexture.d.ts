import { InternalTexture, Nullable } from "@babylonjs/core";
declare module "@babylonjs/core/Engines/thinEngine" {
    interface ThinEngine {
        updatePartialRawTexture2DArray(texture: InternalTexture, level: number, xoffset: number, yoffset: number, zoffset: number, width: number, height: number, depth: number, data: Nullable<ArrayBufferView>, format: number, invertY: boolean, compression: Nullable<string>, textureType: number): void;
        updatePartialRawTexture3D(texture: InternalTexture, level: number, xoffset: number, yoffset: number, zoffset: number, width: number, height: number, depth: number, data: Nullable<ArrayBufferView>, format: number, invertY: boolean, compression: Nullable<string>, textureType: number): void;
    }
}
export declare const __thinEngineExtensions: ((texture: InternalTexture, level: number, xoffset: number, yoffset: number, zoffset: number, width: number, height: number, depth: number, data: Nullable<ArrayBufferView>, format: number, invertY: boolean, compression: Nullable<string>, textureType: number) => void)[];
