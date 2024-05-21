///////////////////////////
// Thin Engine Extension //
///////////////////////////

import { Constants, InternalTexture, InternalTextureSource, Nullable, ThinEngine } from "@babylonjs/core";

declare module "@babylonjs/core/Engines/thinEngine" {
    export interface ThinEngine {
        __SpaceXR__updateSubRawTexture2DArray(
            texture: InternalTexture,
            level: number,
            xoffset: number,
            yoffset: number,
            zoffset: number,
            width: number,
            height: number,
            depth: number,
            data: Nullable<ArrayBufferView> | TexImageSource,
            format: number,
            textureType: number
        ): void;

        __SpaceXR__createRawTexture2DArray(
            width: number,
            height: number,
            depth: number,
            format: number,
            samplingMode: number,
            textureType: number,
            internalFormat?: number
        ): InternalTexture;
    }
}

export function _makeUpdateSubRawTexture2DArrayFunction(is3D: boolean) {
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
        data: Nullable<ArrayBufferView> | TexImageSource,
        format: number = Constants.TEXTUREFORMAT_RGBA,
        textureType: number = Constants.TEXTURETYPE_UNSIGNED_INT
    ): void {
        const target = is3D ? this._gl.TEXTURE_3D : this._gl.TEXTURE_2D_ARRAY;
        const internalType = this._getWebGLTextureType(textureType);
        const internalFormat = this._getInternalFormat(format);
        this._bindTextureDirectly(target, texture, true);

        // When working with WebGL, it's crucial to remember that changes made to the WebGL context's state are global and persistent
        // across all subsequent operations using that context. This means that if you set certain flags or states, such as `UNPACK_FLIP_Y_WEBGL`,
        // they will remain in effect for all future operations unless explicitly changed again.
        // To avoid unintended side-effects and maintain modular, predictable code, it's a best practice to save the current state of
        // the WebGL context before setting mandatory flags or making significant state changes. After you've completed the operations
        // that require these specific settings, you should then restore the context to its original state.
        // This practice ensures that other parts of your application that use the same WebGL context aren't adversely affected by unexpected state changes.
        // In WebGL, however, there's no direct method to save and restore the entire context state at once (like a push/pop mechanism).
        // You need to manually save and restore the parameters that you change. It's important to be mindful of this to maintain the integrity
        // of your rendering process and avoid hard-to-track bugs.
        let flipYState = this._gl.getParameter(this._gl.UNPACK_FLIP_Y_WEBGL);
        if (flipYState) {
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, 0); // Texture 3D does NOT support FLIP_Y
        }

        let preMultiplyAlpha = this._gl.getParameter(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
        if (preMultiplyAlpha) {
            this._gl.pixelStorei(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0); // Texture 3D does NOT support PREMULTIPLY_ALPHA
        }

        this._gl.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, internalFormat, internalType, <any>data);
        let err = this._gl.getError();
        if (err) {
            console.log("Error in sub image", err);
        }
        this._bindTextureDirectly(target, null);
        texture.isReady = true;
        if (flipYState) {
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, 1); // restore state
        }
        if (preMultiplyAlpha) {
            this._gl.pixelStorei(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1); // Restore state
        }
    };
}

ThinEngine.prototype.__SpaceXR__updateSubRawTexture2DArray = _makeUpdateSubRawTexture2DArrayFunction(false);

export function _makeCreateRawTextureFunction(is3D: boolean) {
    return function (
        this: ThinEngine,
        width: number,
        height: number,
        depth: number,
        format: number,
        samplingMode: number,
        textureType: number = Constants.TEXTURETYPE_UNSIGNED_INT,
        internalFormat?: number
    ): InternalTexture {
        const target = is3D ? this._gl.TEXTURE_3D : this._gl.TEXTURE_2D_ARRAY;
        const source = is3D ? InternalTextureSource.Raw3D : InternalTextureSource.Raw2DArray;
        const texture = new InternalTexture(this, source);
        texture.baseWidth = width;
        texture.baseHeight = height;
        texture.baseDepth = depth;
        texture.width = width;
        texture.height = height;
        texture.depth = depth;
        texture.format = format;
        texture.type = textureType;
        texture.samplingMode = samplingMode;
        if (is3D) {
            texture.is3D = true;
        } else {
            texture.is2DArray = true;
        }
        if (texture.width % 4 !== 0) {
            this._gl.pixelStorei(this._gl.UNPACK_ALIGNMENT, 1);
        }
        const internalSizedFomat = internalFormat || this._getRGBABufferInternalSizedFormat(textureType, format);

        this._bindTextureDirectly(target, texture, true);

        // When working with WebGL, it's crucial to remember that changes made to the WebGL context's state are global and persistent
        // across all subsequent operations using that context. This means that if you set certain flags or states, such as `UNPACK_FLIP_Y_WEBGL`,
        // they will remain in effect for all future operations unless explicitly changed again.
        // To avoid unintended side-effects and maintain modular, predictable code, it's a best practice to save the current state of
        // the WebGL context before setting mandatory flags or making significant state changes. After you've completed the operations
        // that require these specific settings, you should then restore the context to its original state.
        // This practice ensures that other parts of your application that use the same WebGL context aren't adversely affected by unexpected state changes.
        // In WebGL, however, there's no direct method to save and restore the entire context state at once (like a push/pop mechanism).
        // You need to manually save and restore the parameters that you change. It's important to be mindful of this to maintain the integrity
        // of your rendering process and avoid hard-to-track bugs.
        let flipYState = this._gl.getParameter(this._gl.UNPACK_FLIP_Y_WEBGL);
        if (flipYState) {
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, 0); // Texture 3D does NOT support FLIP_Y
        }

        let preMultiplyAlpha = this._gl.getParameter(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
        if (preMultiplyAlpha) {
            this._gl.pixelStorei(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0); // Texture 3D does NOT support PREMULTIPLY_ALPHA
        }

        this._gl.texStorage3D(target, 1, internalSizedFomat, texture.width, texture.height, texture.depth);
        let err = this._gl.getError();
        if (err) {
            console.log("Error in storage", err);
        }
        this._bindTextureDirectly(target, null, true);
        texture.isReady = true;
        if (flipYState) {
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, 1); // restore state
        }
        if (preMultiplyAlpha) {
            this._gl.pixelStorei(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1); // Restore state
        }
        return texture;
    };
}

ThinEngine.prototype.__SpaceXR__createRawTexture2DArray = _makeCreateRawTextureFunction(false);

///////////////////////////////
// End Thin Engine Extension //
///////////////////////////////
