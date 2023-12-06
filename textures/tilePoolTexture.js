import { Constants, InternalTexture, InternalTextureSource, Texture, ThinEngine } from "@babylonjs/core";
import { EPSG3857 } from "../packages/dev/babylon/src";
function _makeUpdateSubRawTexture2DArrayFunction(is3D) {
    return function (texture, level, xoffset, yoffset, zoffset, width, height, depth, data, format = Constants.TEXTUREFORMAT_RGBA, textureType = Constants.TEXTURETYPE_UNSIGNED_INT) {
        const target = is3D ? this._gl.TEXTURE_3D : this._gl.TEXTURE_2D_ARRAY;
        const internalType = this._getWebGLTextureType(textureType);
        const internalFormat = this._getInternalFormat(format);
        this._bindTextureDirectly(target, texture, true);
        let flipYState = this._gl.getParameter(this._gl.UNPACK_FLIP_Y_WEBGL);
        if (flipYState) {
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, 0);
        }
        let preMultiplyAlpha = this._gl.getParameter(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
        if (preMultiplyAlpha) {
            this._gl.pixelStorei(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
        }
        this._gl.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, internalFormat, internalType, data);
        let err = this._gl.getError();
        if (err) {
            console.log("Error in sub image", err);
        }
        this._bindTextureDirectly(target, null);
        texture.isReady = true;
        if (flipYState) {
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, 1);
        }
        if (preMultiplyAlpha) {
            this._gl.pixelStorei(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        }
    };
}
ThinEngine.prototype.__SpaceXR___updateSubRawTexture2DArray = _makeUpdateSubRawTexture2DArrayFunction(false);
function _makeCreateRawTextureFunction(is3D) {
    return function (width, height, depth, format, samplingMode, textureType = Constants.TEXTURETYPE_UNSIGNED_INT, internalFormat) {
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
        }
        else {
            texture.is2DArray = true;
        }
        if (texture.width % 4 !== 0) {
            this._gl.pixelStorei(this._gl.UNPACK_ALIGNMENT, 1);
        }
        const internalSizedFomat = internalFormat || this._getRGBABufferInternalSizedFormat(textureType, format);
        this._bindTextureDirectly(target, texture, true);
        let flipYState = this._gl.getParameter(this._gl.UNPACK_FLIP_Y_WEBGL);
        if (flipYState) {
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, 0);
        }
        let preMultiplyAlpha = this._gl.getParameter(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
        if (preMultiplyAlpha) {
            this._gl.pixelStorei(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
        }
        this._gl.texStorage3D(target, 1, internalSizedFomat, texture.width, texture.height, texture.depth);
        let err = this._gl.getError();
        if (err) {
            console.log("Error in storage", err);
        }
        this._bindTextureDirectly(target, null, true);
        texture.isReady = true;
        if (flipYState) {
            this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, 1);
        }
        if (preMultiplyAlpha) {
            this._gl.pixelStorei(this._gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        }
        return texture;
    };
}
ThinEngine.prototype.__SpaceXR___createRawTexture2DArray = _makeCreateRawTextureFunction(false);
class TilePoolTextureOptions {
    constructor(p) {
        this.data = null;
        this.metrics = EPSG3857.Shared;
        this.count = 1;
        this.format = Constants.TEXTUREFORMAT_RGBA;
        this.textureType = Constants.TEXTURETYPE_UNSIGNED_INT;
        this.generateMipmap = false;
        this.samplingMode = Texture.NEAREST_NEAREST;
        if (p) {
            Object.assign(this, p);
        }
    }
}
TilePoolTextureOptions.Default = new TilePoolTextureOptions();
export { TilePoolTextureOptions };
class TilePoolTextureArea {
    constructor(owner, id) {
        this._owner = owner;
        this._id = id;
        this._released = false;
    }
    update(data) {
        if (this._released) {
            throw new Error("Invalid state, area has been released.");
        }
        this._owner._updateArea(this.id, data);
    }
    release() {
        if (!this._released) {
            this._owner._releaseArea(this._id);
            this._released = true;
        }
    }
    get id() {
        return this._id;
    }
}
export class TilePoolTexture extends Texture {
    constructor(name, options, scene) {
        const o = { ...TilePoolTextureOptions.Default, ...options };
        super(null, scene, !o.generateMipmap, false);
        this.name = name;
        this._o = o;
        this._areas = new Array(this.areaCount).fill(null);
        this._used = 0;
        const s = this._o.metrics.tileSize;
        this._texture = scene
            .getEngine()
            .__SpaceXR___createRawTexture2DArray(s, s, this._o.count, this._o.format, this._o.samplingMode, this._o.textureType, this._o.internalFormat);
        this.wrapU = Texture.CLAMP_ADDRESSMODE;
        this.wrapV = Texture.CLAMP_ADDRESSMODE;
    }
    reserveArea() {
        if (this.freeAreaCount) {
            for (let i = 0; i != this._areas.length; i++) {
                if (this._areas[i] === null) {
                    const a = new TilePoolTextureArea(this, i);
                    this._areas[i] = a;
                    this._used++;
                    return a;
                }
            }
        }
        return null;
    }
    get areaCount() {
        return this._o.count || 1;
    }
    get freeAreaCount() {
        return this.areaCount - this._used;
    }
    get usedAreaCount() {
        return this._used;
    }
    _releaseArea(i) {
        if (this._used > 0 && i >= 0 && i < this._areas.length && this._areas[i] !== null) {
            this._areas[i] = null;
            this._used--;
        }
    }
    _updateArea(i, data) {
        const engine = this._getEngine();
        if (engine && this._texture) {
            const s = this._o.metrics.tileSize;
            engine.__SpaceXR___updateSubRawTexture2DArray(this._texture, 0, 0, 0, i, s, s, 1, data, this._texture.format, this._texture.type);
        }
    }
}
//# sourceMappingURL=tilePoolTexture.js.map