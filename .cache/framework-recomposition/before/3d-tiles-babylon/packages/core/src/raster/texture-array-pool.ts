import { Constants } from "@babylonjs/core/Engines/constants.js";
import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture.js";
import { Observable } from "@babylonjs/core/Misc/observable.js";
import type { Scene } from "@babylonjs/core/scene.js";

import {
    createTextureArrayBackend,
    TEXTURE_ARRAY_TEXEL_BYTES,
    type ITextureArrayBackend,
    type TextureArrayFormat,
} from "./texture-array-backends";

export type { TextureArrayFormat } from "./texture-array-backends";

export interface ITextureArrayPoolOptions {
    /** Width and height of every layer, in texels. */
    size: number;
    /** Layers allocated at creation. Defaults to 64. */
    initialLayers?: number;
    /** Growth factor applied when the pool is full. Defaults to 1.5. */
    growth?: number;
    /**
     * Texel format. `rgba8` (default) holds colours, filtered bilinearly. `rgba32f` holds data read with `texelFetch`,
     * such as indirection tables, and `r32f` one value per texel, such as heights; float layers are not filtered.
     */
    format?: TextureArrayFormat;
}

/**
 * Pool of pages stored in one texture array, ported from the SpaceXR `Texture3`, on WebGL 2 and WebGPU.
 *
 * Each page is one layer, written alone, which Babylon's `RawTexture2DArray` cannot do: it only uploads the whole
 * array. When every layer is used, the pool grows into a larger array and copies the layers on the GPU, except float
 * layers on WebGL 2, which owners write again on `onGrowObservable`. Pages are clamped to their edges; shaders select
 * the page with the third texture coordinate.
 */
export class TextureArrayPool extends BaseTexture {
    public readonly size: number;
    public readonly format: TextureArrayFormat;
    /** Notified after the pool grew. Owners write their layers again when {@link layersKeptOnGrowth} is false. */
    public readonly onGrowObservable = new Observable<TextureArrayPool>();
    private readonly backend: ITextureArrayBackend;
    private readonly growth: number;
    private readonly free: number[] = [];
    private layers: number;
    private used = 0;
    private kept = true;

    public constructor(scene: Scene, options: ITextureArrayPoolOptions) {
        super(scene);
        if (!Number.isInteger(options.size) || options.size < 1) throw new RangeError("The page size must be a positive integer.");
        this.size = options.size;
        this.format = options.format ?? "rgba8";
        this.backend = createTextureArrayBackend(scene.getEngine(), this.size, this.format);
        this.growth = Math.max(options.growth ?? 1.5, 1.1);
        this.layers = Math.max(1, options.initialLayers ?? 64);
        this.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE;
        this.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
        this._texture = this.backend.create(this.layers);
        for (let layer = this.layers - 1; layer >= 0; layer--) this.free.push(layer);
    }

    /** Layers allocated on the GPU. */
    public get capacity(): number {
        return this.layers;
    }

    /** Layers holding a page. */
    public get count(): number {
        return this.used;
    }

    /** Bytes allocated on the GPU. */
    public get gpuBytes(): number {
        return this.layers * this.size * this.size * TEXTURE_ARRAY_TEXEL_BYTES[this.format];
    }

    /** Whether the layers survived the last growth; owners write them again otherwise. */
    public get layersKeptOnGrowth(): boolean {
        return this.kept;
    }

    public override getClassName(): string {
        return "TextureArrayPool";
    }

    /**
     * Reserves a layer, growing the array when it is full.
     *
     * @returns The layer, or `undefined` when the device texture array limit is reached.
     */
    public reserve(): number | undefined {
        if (this.free.length === 0 && !this.grow()) return undefined;
        this.used++;
        return this.free.pop();
    }

    /** Returns a layer to the pool. Its texels stay until the layer is written again. */
    public release(layer: number): void {
        if (layer < 0 || layer >= this.layers || this.free.includes(layer)) return;
        this.free.push(layer);
        this.used--;
    }

    /**
     * Writes texels into a layer, by default the whole page.
     *
     * @param data - Values for `width * height` texels, rows from the top of the page: four bytes per texel for
     *     `rgba8`, four floats for `rgba32f`, one float for `r32f`.
     */
    public write(layer: number, data: ArrayBufferView, x = 0, y = 0, width = this.size, height = this.size): void {
        const texture = this._texture;
        if (texture) this.backend.write(texture, layer, data, x, y, width, height);
    }

    /** Moves the pages into a larger array; `false` when the device limit is reached. */
    private grow(): boolean {
        const old = this._texture;
        if (!old) return false;
        const limit = this._getEngine()?.getCaps().texture2DArrayMaxLayerCount || 256;
        const layers = Math.min(limit, Math.max(this.layers + 1, Math.ceil(this.layers * this.growth)));
        if (layers <= this.layers) return false;

        const texture = this.backend.create(layers);
        this.kept = this.backend.copy(old, texture, this.layers);
        old.dispose();
        this._texture = texture;
        for (let layer = layers - 1; layer >= this.layers; layer--) this.free.push(layer);
        this.layers = layers;
        this.onGrowObservable.notifyObservers(this);
        return true;
    }

    public override dispose(): void {
        this.onGrowObservable.clear();
        super.dispose();
    }
}
