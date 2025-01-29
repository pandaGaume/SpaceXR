import { BaseTexture, Constants, ISize, Nullable, Scene, ThinEngine } from "@babylonjs/core";

export interface ITexture3Layer {
    host?: ITexture3;
    depth: number;
    update(data: Nullable<ArrayBufferView> | TexImageSource, row?: number, column?: number, width?: number, height?: number): void;
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
    wrapU?: number;
    wrapV?: number;
}

export interface ITexture3 extends ISize {
    depth: number; // the number of possible layers.
    count: number; // the number of layers in use.

    update(depth: number, data: Nullable<ArrayBufferView> | TexImageSource, xoffset?: number, yoffset?: number, width?: number, height?: number): void;
    release(depth: number): void;
    reserve(): ITexture3Layer | undefined;
    ensureRoomFor(count: number): boolean;
}

class Texture3Layer implements ITexture3Layer {
    _host: ITexture3;
    _depth: number;

    constructor(host: ITexture3, id: number) {
        this._host = host;
        this._depth = id;
    }

    public update(data: Nullable<ArrayBufferView> | TexImageSource, row?: number, column?: number, width?: number, height?: number): void {
        this._host.update(this._depth, data, row, column, width, height);
    }

    public release(): void {
        this._host.release(this._depth);
    }

    public get depth(): number {
        return this._depth;
    }

    public get host(): ITexture3 {
        return this._host;
    }
}

export class Texture3 extends BaseTexture implements ITexture3 {
    _w: number; // the width of the texture.
    _h: number; // the height of the texture.
    _count: number; // the number of layers in use.
    _layers: Array<Nullable<ITexture3Layer>>;
    _internalFormat?: number;

    public constructor(
        sceneOrEngine: Nullable<Scene | ThinEngine>,
        width: number | ITexture3CreationOptions,
        height?: number,
        depth?: number,
        format?: number,
        textureType?: number,
        internalFormat?: number,
        generateMipmaps?: boolean,
        samplingMode?: number,
        wrapU?: number,
        wrapV?: number
    ) {
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
            wrapU = options.wrapU;
            wrapV = options.wrapV;
        }

        height = height ?? width;
        depth = depth ?? 1;
        format = format ?? Constants.TEXTUREFORMAT_RGBA;
        textureType = textureType ?? Constants.TEXTURETYPE_UNSIGNED_INT;
        generateMipmaps = generateMipmaps ?? false;
        samplingMode = samplingMode ?? Constants.TEXTURE_NEAREST_NEAREST;

        this._layers = new Array(depth).fill(null);
        this._count = 0;
        this._w = width;
        this._h = height;
        // save internal format for later use on copy
        this._internalFormat = internalFormat;

        this._texture = this._getEngine()!.__SpaceXR__createRawTexture2DArray(width, height, depth, format, samplingMode, textureType, internalFormat);
        this.wrapU = wrapU ?? Constants.TEXTURE_CLAMP_ADDRESSMODE;
        this.wrapV = wrapV ?? Constants.TEXTURE_CLAMP_ADDRESSMODE;
    }

    public get width(): number {
        return this._w;
    }
    public get height(): number {
        return this._h;
    }
    public get depth(): number {
        return this._layers.length;
    }
    public get count(): number {
        return this._count;
    }

    public reserve(): ITexture3Layer | undefined {
        let a: Nullable<ITexture3Layer> | undefined = undefined;
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
        //console.log(`reserved layer ${a?.depth} used: ${this.count} / ${this.depth}`);
        return a;
    }

    public update(depth: number, data: Nullable<ArrayBufferView> | TexImageSource, xoffset?: number, yoffset?: number, width?: number, height?: number): void {
        const engine = this._getEngine();
        if (engine && this._texture) {
            engine.__SpaceXR__updateSubRawTexture2DArray(
                this._texture,
                0, // specifying the level of detail - 0 is the base image
                xoffset ?? 0, // column where pixel data should go
                yoffset ?? 0, // row where pixel data should go
                depth, // array "index" for pixels
                width ?? this._w, // width of pixel data
                height ?? this._h, // height of pixel data
                1, // number of slice for this data
                data,
                this._texture.format, // data format of pixel data
                this._texture.type // data type of pixel data
            );
        }
    }

    public release(depth: number): void {
        if (this._count > 0 && depth >= 0 && depth < this.depth) {
            const layer = this._layers[depth];
            if (layer) {
                this._layers[depth] = null;
                this._count--;
            }
        }
    }

    public ensureRoomFor(count: number): boolean {
        const oldTexture = this._texture;
        if (!oldTexture) {
            return false;
        }
        if (this.depth - this.count >= count) {
            return true; // Enough space already
        }

        const gl = this._getEngine()?._gl;
        if (!gl) {
            return false;
        }
        const maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
        const targetDepth = count + this.depth;

        let newDepth = this.depth;
        do {
            newDepth = Math.max(count, Math.ceil(this.depth * 1.3));
        } while (newDepth < targetDepth);

        newDepth = Math.min(newDepth, maxLayers);

        if (newDepth < targetDepth) {
            console.log(`Max supported texture layers:${maxLayers}, asked for ${targetDepth}`);
            return false;
        }
        console.log(`Grow texture layers from ${this.depth} to ${newDepth}`);

        const engine = this._getEngine();
        if (!engine) {
            return false;
        }
        // Create a new texture with larger depth
        const newTexture = engine.__SpaceXR__createRawTexture2DArray(this._w, this._h, newDepth, oldTexture.format, oldTexture.samplingMode, oldTexture.type, this._internalFormat);
        engine.__SpaceXR__copyRawTexture2DArray(oldTexture, newTexture);

        // Replace the old texture with the new one
        oldTexture.dispose();
        this._texture = newTexture;
        this._layers = this._layers.concat(new Array(newDepth - this._layers.length).fill(null)); // Reset layers array
        return true;
    }

    protected _buildLayer(z: number): ITexture3Layer {
        const layer = new Texture3Layer(this, z);
        if (!layer.host) {
            console.error(`Layer host was not set correctly for depth: ${z}`);
        }
        return layer;
    }
}
