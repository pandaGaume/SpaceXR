import { Constants, InternalTexture, Nullable } from "@babylonjs/core";
import { ThinEngine } from "@babylonjs/core/Engines/thinEngine";

declare module "@babylonjs/core/Engines/thinEngine" {
    export interface ThinEngine {
        updatePartialRawTexture2DArray(
            texture: InternalTexture,
            level: number,
            xoffset: number,
            yoffset: number,
            zoffset: number,
            width: number,
            height: number,
            depth: number,
            data: Nullable<ArrayBufferView>,
            format: number,
            invertY: boolean,
            compression: Nullable<string>,
            textureType: number
        ): void;
        updatePartialRawTexture3D(
            texture: InternalTexture,
            level: number,
            xoffset: number,
            yoffset: number,
            zoffset: number,
            width: number,
            height: number,
            depth: number,
            data: Nullable<ArrayBufferView>,
            format: number,
            invertY: boolean,
            compression: Nullable<string>,
            textureType: number
        ): void;
    }
}

function _makeUpdatePartialRawTextureFunction(is3D: boolean) {
    return function (
        this: ThinEngine,
        texture: InternalTexture,
        level: number,
        xoffset: number,
        yoffset: number,
        zoffset: number,
        width: number,
        height: number,
        depth: number,
        data: Nullable<ArrayBufferView>,
        format: number,
        invertY: boolean,
        compression: Nullable<string>,
        textureType: number = Constants.TEXTURETYPE_UNSIGNED_INT
    ): void {
        const target = is3D ? this._gl.TEXTURE_3D : this._gl.TEXTURE_2D_ARRAY;

        const internalType = this._getWebGLTextureType(textureType);
        const internalFormat = this._getInternalFormat(format);

        this._bindTextureDirectly(target, texture, true);
        this._unpackFlipY(invertY === undefined ? true : invertY ? true : false);

        if (!this._doNotHandleContextLost) {
            texture._bufferView = data;
            texture.format = format;
            texture.invertY = invertY;
            texture._compression = compression;
        }

        if (texture.width % 4 !== 0) {
            this._gl.pixelStorei(this._gl.UNPACK_ALIGNMENT, 1);
        }

        if (compression && data) {
            this._gl.compressedTexSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, internalFormat, data);
        } else {
            this._gl.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, internalFormat, internalType, data);
        }

        this._bindTextureDirectly(target, null, true);
        texture.isReady = true;
    };
}

ThinEngine.prototype.updatePartialRawTexture2DArray = _makeUpdatePartialRawTextureFunction(false);
ThinEngine.prototype.updatePartialRawTexture3D = _makeUpdatePartialRawTextureFunction(true);

// internal
export const __thinEngineExtensions = [ThinEngine.prototype.updatePartialRawTexture2DArray, ThinEngine.prototype.updatePartialRawTexture3D];
