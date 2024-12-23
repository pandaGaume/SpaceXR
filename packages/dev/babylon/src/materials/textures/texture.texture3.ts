import { BaseTexture, Constants, ISize, Nullable, Scene, ThinEngine } from "@babylonjs/core";

export interface ITexture3Layer {
    host?: ITexture3;
    depth: number;
    update(data: Nullable<ArrayBufferView> | TexImageSource, row: number, column: number, width?: number, height?: number): void;
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
}

export interface ITexture3 extends ISize {
    depth: number; // the number of possible layers.
    count: number; // the number of layers in use.

    update(depth: number, data: Nullable<ArrayBufferView> | TexImageSource, row: number, column: number, width?: number, height?: number): void;
    release(depth: number): void;
    reserve(): ITexture3Layer | undefined;
}

class Texture3Layer implements ITexture3Layer {
    _host?: ITexture3;
    _depth: number;

    constructor(host: ITexture3, id: number) {
        this._host = host;
        this._depth = id;
    }

    public update(data: Nullable<ArrayBufferView> | TexImageSource, row: number = 0, column: number = 0, width?: number, height?: number): void {
        this._host?.update(this._depth, data, row, column, width, height);
    }

    public release(): void {
        if (this._host) {
            this._host.release(this._depth);
            this._host = undefined;
        }
    }

    public get depth(): number {
        return this._depth;
    }

    public get host(): ITexture3 | undefined {
        return this._host;
    }
}

export class Texture3 extends BaseTexture implements ITexture3 {
    _w: number; // the width of the texture.
    _h: number; // the height of the texture.
    _count: number; // the number of layers in use.
    _layers: Array<Nullable<ITexture3Layer>>;

    public constructor(
        sceneOrEngine: Nullable<Scene | ThinEngine>,
        width: number | ITexture3CreationOptions,
        height?: number,
        depth?: number,
        format?: number,
        textureType?: number,
        internalFormat?: number,
        generateMipmaps?: boolean,
        samplingMode?: number
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

        this._texture = this._getEngine()!.__SpaceXR__createRawTexture2DArray(width, height, depth, format, samplingMode, textureType, internalFormat);
        this.wrapU = this.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
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

    public update(depth: number, data: Nullable<ArrayBufferView> | TexImageSource, row: number = 0, column: number = 0, width?: number, height?: number): void {
        const engine = this._getEngine();
        if (engine && this._texture) {
            engine.__SpaceXR__updateSubRawTexture2DArray(
                this._texture,
                0, // specifying the level of detail - 0 is the base image
                row, // row where pixel data should go
                column, // column where pixel data should go
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
        if (this._count > 0 && depth >= 0 && depth < this.depth && this._layers[depth] !== null) {
            const layer = this._layers[depth]!;
            this._layers[depth] = null;
            this._count--;
            layer.release(); // release the layer internally
        }
        //console.log(`released layer ${depth} used: ${this.count} / ${this.depth}`);
    }

    protected _buildLayer(z: number): ITexture3Layer {
        return new Texture3Layer(this, z);
    }
}
