import { Nullable } from "@babylonjs/core";
import { UpdateRawTextureOptions } from "@babylonjs/core/Materials/Textures/rawTexture2DArray";
declare module "@babylonjs/core/Materials/Textures/rawTexture2DArray" {
    class UpdateRawTextureOptions {
        level: number;
        xoffset: number;
        yoffset: number;
        zoffset: number;
        width: number;
        height: number;
        depth: number;
    }
    interface RawTexture2DArray {
        updatePartial(data: Nullable<ArrayBufferView>, level?: UpdateRawTextureOptions | number, xoffset?: number, yoffset?: number, zoffset?: number, width?: number, height?: number, depth?: number): void;
    }
}
export declare const __RawTexture2DArrayExtensions: ((data: Nullable<ArrayBufferView>, level?: number | UpdateRawTextureOptions | undefined, xoffset?: number, yoffset?: number, zoffset?: number, width?: number, height?: number, depth?: number) => void)[];
