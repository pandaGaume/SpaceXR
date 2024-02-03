import { BaseTexture, Constants } from "@babylonjs/core";
class Texture3Layer {
    constructor(host, id) {
        this._host = host;
        this._depth = id;
    }
    update(data) {
        this._host?.update(this._depth, data);
    }
    release() {
        if (this._host) {
            this._host.release(this._depth);
            this._host = undefined;
        }
    }
    get depth() {
        return this._depth;
    }
    get host() {
        return this._host;
    }
}
export class Texture3 extends BaseTexture {
    constructor(sceneOrEngine, width, height, depth, format, textureType, internalFormat, generateMipmaps, samplingMode) {
        super(sceneOrEngine);
        if (typeof width === "object" && width !== null) {
            const options = width;
            width = options.width;
            height = options.height;
            depth = options.depth;
            format = options.format;
            textureType = options.textureType;
            internalFormat = options.internalFormat;
            generateMipmaps = options.generateMipmap;
            samplingMode = options.samplingMode;
        }
        height = height ?? width;
        depth = depth ?? 1;
        format = format ?? Constants.TEXTUREFORMAT_RGBA;
        textureType = textureType ?? Constants.TEXTURETYPE_UNSIGNED_INT;
        internalFormat = internalFormat ?? format;
        generateMipmaps = generateMipmaps ?? false;
        samplingMode = samplingMode ?? Constants.TEXTURE_NEAREST_NEAREST;
        this._layers = new Array(depth).fill(null);
        this._count = 0;
        this._w = width;
        this._h = height;
        this._texture = this._getEngine().__SpaceXR__createRawTexture2DArray(width, height, depth, format, samplingMode, textureType, internalFormat);
        this.wrapU = this.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
    }
    get width() {
        return this._w;
    }
    get height() {
        return this._h;
    }
    get depth() {
        return this._layers.length;
    }
    get count() {
        return this._count;
    }
    reserve() {
        let a = undefined;
        if (this.count < this.depth) {
            for (let i = 0; i != this._layers.length; i++) {
                if (this._layers[i] === null) {
                    a = this._buildLayer(i);
                    this._layers[i] = a;
                    this._count++;
                    break;
                }
            }
        }
        return a;
    }
    update(depth, data) {
        const engine = this._getEngine();
        if (engine && this._texture) {
            engine.__SpaceXR__updateSubRawTexture2DArray(this._texture, 0, 0, 0, depth, this._w, this._h, 1, data, this._texture.format, this._texture.type);
        }
    }
    release(depth) {
        if (this._count > 0 && depth >= 0 && depth < this.depth && this._layers[depth] !== null) {
            const layer = this._layers[depth];
            this._layers[depth] = null;
            this._count--;
            layer.release();
        }
    }
    _buildLayer(z) {
        return new Texture3Layer(this, z);
    }
}
//# sourceMappingURL=texture3.js.map