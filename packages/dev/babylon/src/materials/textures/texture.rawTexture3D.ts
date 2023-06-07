import { Nullable } from "@babylonjs/core";
import { RawTexture2DArray, UpdateRawTextureOptions } from "@babylonjs/core/Materials/Textures/rawTexture2DArray";

declare module "@babylonjs/core/Materials/Textures/rawTexture2DArray" {
    export class UpdateRawTextureOptions {
        level: number;
        xoffset: number;
        yoffset: number;
        zoffset: number;
        width: number;
        height: number;
        depth: number;
    }

    export interface RawTexture2DArray {
        updatePartial(
            data: Nullable<ArrayBufferView>,
            level?: UpdateRawTextureOptions | number,
            xoffset?: number,
            yoffset?: number,
            zoffset?: number,
            width?: number,
            height?: number,
            depth?: number
        ): void;
    }
}

RawTexture2DArray.prototype.updatePartial = function (
    data: Nullable<ArrayBufferView>,
    level?: UpdateRawTextureOptions | number,
    xoffset?: number,
    yoffset?: number,
    zoffset?: number,
    width?: number,
    height?: number,
    depth?: number
) {
    if (!this._texture) {
        return;
    }
    if (!level) {
        (<any>this)._getEngine()!.updateRawTexture2DArray(this._texture, data, this._texture.format, this._texture!.invertY, null, this._texture.type);
        return;
    }
    if (level instanceof UpdateRawTextureOptions) {
        (<any>this)
            ._getEngine()!
            .updatePartialRawTexture2DArray(
                this._texture,
                level.level,
                level.xoffset,
                level.yoffset,
                level.zoffset,
                level.width,
                level.height,
                level.depth,
                data,
                this._texture.format,
                this._texture!.invertY,
                null,
                this._texture.type
            );
    } else {
        (<any>this)
            ._getEngine()!
            .updatePartialRawTexture2DArray(
                this._texture,
                level,
                xoffset,
                yoffset,
                zoffset,
                width,
                height,
                depth,
                data,
                this._texture.format,
                this._texture!.invertY,
                null,
                this._texture.type
            );
    }
};

// internal
export const __RawTexture2DArrayExtensions = [RawTexture2DArray.prototype.updatePartial];
