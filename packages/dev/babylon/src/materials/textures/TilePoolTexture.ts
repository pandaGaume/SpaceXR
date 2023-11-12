import { Constants, InternalTexture, InternalTextureSource, Nullable, Scene, Texture, ThinEngine } from "@babylonjs/core";
import { EPSG3857, ITileMetrics } from "../..";

///////////////////////////
// Thin Engine Extension //
///////////////////////////

declare module "@babylonjs/core/Engines/thinEngine" {
    export interface ThinEngine {
        __SpaceXR___updateSubRawTexture2DArray(
            texture: InternalTexture,
            level: number,
            xoffset: number,
            yoffset: number,
            zoffset: number,
            width: number,
            height: number,
            depth: number,
            data: TilePoolData,
            format: number,
            textureType: number
        ): void;

        __SpaceXR___createRawTexture2DArray(
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

function _makeUpdateSubRawTexture2DArrayFunction(is3D: boolean) {
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
        data: TilePoolData,
        format: number = Constants.TEXTUREFORMAT_RGBA,
        textureType: number = Constants.TEXTURETYPE_UNSIGNED_INT
    ): void {
        const target = is3D ? this._gl.TEXTURE_3D : this._gl.TEXTURE_2D_ARRAY;
        const internalType = this._getWebGLTextureType(textureType);
        const internalFormat = this._getInternalFormat(format);
        this._bindTextureDirectly(target, texture, true);
        this._gl.texSubImage3D(target, level, xoffset, yoffset, zoffset, width, height, depth, internalFormat, internalType, <any>data);
        let err = this._gl.getError();
        if (err) {
            console.log("Error in sub image", err);
        }
        this._bindTextureDirectly(target, null);
        texture.isReady = true;
    };
}

ThinEngine.prototype.__SpaceXR___updateSubRawTexture2DArray = _makeUpdateSubRawTexture2DArrayFunction(false);

function _makeCreateRawTextureFunction(is3D: boolean) {
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
        this._gl.texStorage3D(target, 1, internalSizedFomat, texture.width, texture.height, texture.depth);
        let err = this._gl.getError();
        if (err) {
            console.log("Error in storage", err);
        }
        this._bindTextureDirectly(target, null, true);
        texture.isReady = true;
        return texture;
    };
}

ThinEngine.prototype.__SpaceXR___createRawTexture2DArray = _makeCreateRawTextureFunction(false);

///////////////////////////////
// End Thin Engine Extension //
///////////////////////////////

export type TilePoolData = Nullable<ArrayBufferView> | TexImageSource;

export interface ITilePoolTextureArea {
    id: number;
    update(data: TilePoolData): void;
    release(): void;
}

export interface ITilePoolTexture {
    areaCount: number;
    freeAreaCount: number;
    usedAreaCount: number;
    reserveArea(): Nullable<TilePoolTextureArea>;
}

export class TilePoolTextureOptions {
    static Default = new TilePoolTextureOptions();

    data: TilePoolData = null;
    metrics: ITileMetrics = EPSG3857.Shared;
    count: number = 1;
    format: number = Constants.TEXTUREFORMAT_RGBA;
    textureType: number = Constants.TEXTURETYPE_UNSIGNED_INT;
    internalFormat?: number;

    generateMipmap: boolean = false;
    samplingMode: number = Texture.NEAREST_NEAREST;

    public constructor(p?: Partial<TilePoolTextureOptions>) {
        if (p) {
            Object.assign(this, p);
        }
    }
}

class TilePoolTextureArea implements ITilePoolTextureArea {
    _owner: TilePoolTexture;
    _id: number;
    private _released: boolean;

    constructor(owner: TilePoolTexture, id: number) {
        this._owner = owner;
        this._id = id;
        this._released = false;
    }

    public update(data: TilePoolData): void {
        if (this._released) {
            throw new Error("Invalid state, area has been released.");
        }
        this._owner._updateArea(this.id, data);
    }

    public release(): void {
        if (!this._released) {
            this._owner._releaseArea(this._id);
            this._released = true;
        }
    }

    public get id(): number {
        return this._id;
    }
}

export class TilePoolTexture extends Texture implements ITilePoolTexture {
    _o: TilePoolTextureOptions;
    _areas: Array<Nullable<TilePoolTextureArea>>;
    _used: number;

    public constructor(name: string, options: TilePoolTextureOptions, scene: Scene) {
        const o = { ...TilePoolTextureOptions.Default, ...options };
        super(null, scene, !o.generateMipmap, false);
        this.name = name;

        this._o = o;
        this._areas = new Array<Nullable<TilePoolTextureArea>>(this.areaCount).fill(null);
        this._used = 0;

        const s = this._o.metrics.tileSize;
        this._texture = scene
            .getEngine()
            .__SpaceXR___createRawTexture2DArray(s, s, this._o.count, this._o.format, this._o.samplingMode, this._o.textureType, this._o.internalFormat);
        this.wrapU = Texture.CLAMP_ADDRESSMODE;
        this.wrapV = Texture.CLAMP_ADDRESSMODE;
        //this.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
    }

    public reserveArea(): Nullable<TilePoolTextureArea> {
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

    public get areaCount(): number {
        return this._o.count || 1;
    }

    public get freeAreaCount(): number {
        return this.areaCount - this._used;
    }

    public get usedAreaCount(): number {
        return this._used;
    }

    _releaseArea(i: number): void {
        if (this._used > 0 && i >= 0 && i < this._areas.length && this._areas[i] !== null) {
            this._areas[i] = null;
            this._used--;
        }
    }

    _updateArea(i: number, data: TilePoolData): void {
        const engine = this._getEngine();
        if (engine && this._texture) {
            const s = this._o.metrics!.tileSize;

            engine.__SpaceXR___updateSubRawTexture2DArray(
                this._texture,
                0, // specifying the level of detail - 0 is the base image
                0, // ro where pixel data should go
                0, // column where pixel data should go
                i, // array "index" for pixels
                s, // width of pixel data
                s, // height of pixel data
                1, // number of slice for this data
                data,
                this._texture.format, // data format of pixel data
                this._texture.type // data type of pixel data
            );
        }
    }
}
