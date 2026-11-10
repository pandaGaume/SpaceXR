import { Constants } from "@babylonjs/core/Engines/constants.js";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import { InternalTexture, InternalTextureSource } from "@babylonjs/core/Materials/Textures/internalTexture.js";

/** Texel format of a texture array. */
export type TextureArrayFormat = "rgba8" | "rgba32f" | "r32f";

/** Bytes per texel of each format. */
export const TEXTURE_ARRAY_TEXEL_BYTES: Record<TextureArrayFormat, number> = { rgba8: 4, rgba32f: 16, r32f: 4 };

/** Graphics API calls of a texture array pool: creating an array, writing one layer, copying layers. */
export interface ITextureArrayBackend {
    /** Creates an array of `layers` layers. */
    create(layers: number): InternalTexture;
    /** Writes texels into one layer, rows from the top. */
    write(texture: InternalTexture, layer: number, data: ArrayBufferView, x: number, y: number, width: number, height: number): void;
    /**
     * Copies the first `layers` layers of an array into another, on the GPU.
     *
     * @returns `false` when this backend cannot copy the format, so that owners write their layers again.
     */
    copy(source: InternalTexture, target: InternalTexture, layers: number): boolean;
}

function formatConstants(format: TextureArrayFormat): { format: number; type: number; samplingMode: number } {
    const float = format !== "rgba8";
    return {
        format: format === "r32f" ? Constants.TEXTUREFORMAT_R : Constants.TEXTUREFORMAT_RGBA,
        type: float ? Constants.TEXTURETYPE_FLOAT : Constants.TEXTURETYPE_UNSIGNED_BYTE,
        // Float data is read texel by texel; colours are filtered bilinearly.
        samplingMode: float ? Constants.TEXTURE_NEAREST_SAMPLINGMODE : Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
    };
}

/** WebGL 2 members of the Babylon engine used to address single layers of a texture array. */
interface IWebGL2TextureEngine extends AbstractEngine {
    _gl: WebGL2RenderingContext;
    _bindTextureDirectly(target: number, texture: InternalTexture | null, forTextureDataUpdate?: boolean, force?: boolean): boolean;
}

/** WebGPU members of the Babylon engine used to address single layers of a texture array. */
interface IWebGPUTextureEngine extends AbstractEngine {
    _device: {
        createCommandEncoder(): { copyTextureToTexture(source: unknown, destination: unknown, size: unknown): void; finish(): unknown };
        queue: { submit(commandBuffers: unknown[]): void };
    };
    _textureHelper: {
        updateTexture(
            data: Uint8Array,
            texture: InternalTexture,
            width: number,
            height: number,
            layers: number,
            format: string,
            faceIndex: number,
            mipLevel: number,
            invertY: boolean,
            premultiplyAlpha: boolean,
            offsetX: number,
            offsetY: number,
        ): void;
    };
    createRawTexture2DArray(
        data: ArrayBufferView | null,
        width: number,
        height: number,
        depth: number,
        format: number,
        generateMipMaps: boolean,
        invertY: boolean,
        samplingMode: number,
        compression: string | null,
        textureType: number,
    ): InternalTexture;
}

/**
 * WebGL 2 texture arrays, written layer by layer with `texSubImage3D`, which Babylon's `RawTexture2DArray` cannot do: it
 * only uploads the whole array. RGBA8 layers are copied through a framebuffer when the array grows; float layers are
 * not, since copying them needs `EXT_color_buffer_float`.
 */
export class WebGL2TextureArrayBackend implements ITextureArrayBackend {
    public constructor(
        private readonly engine: IWebGL2TextureEngine,
        private readonly size: number,
        private readonly format: TextureArrayFormat,
    ) {}

    public create(layers: number): InternalTexture {
        const { engine, size, format } = this;
        const gl = engine._gl;
        const texture = new InternalTexture(engine, InternalTextureSource.Raw2DArray);
        texture.baseWidth = texture.width = size;
        texture.baseHeight = texture.height = size;
        texture.baseDepth = texture.depth = layers;
        texture.is2DArray = true;
        const constants = formatConstants(format);
        texture.format = constants.format;
        texture.type = constants.type;
        texture.samplingMode = constants.samplingMode;
        texture.generateMipMaps = false;
        engine._bindTextureDirectly(gl.TEXTURE_2D_ARRAY, texture, true);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, { rgba8: gl.RGBA8, rgba32f: gl.RGBA32F, r32f: gl.R32F }[format], size, size, layers);
        const filter = format === "rgba8" ? gl.LINEAR : gl.NEAREST;
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        engine._bindTextureDirectly(gl.TEXTURE_2D_ARRAY, null);
        texture.isReady = true;
        return texture;
    }

    public write(
        texture: InternalTexture,
        layer: number,
        data: ArrayBufferView,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        const { engine, format } = this;
        const gl = engine._gl;
        engine._bindTextureDirectly(gl.TEXTURE_2D_ARRAY, texture, true);
        this.withUnpackDefaults(gl, () =>
            gl.texSubImage3D(
                gl.TEXTURE_2D_ARRAY,
                0,
                x,
                y,
                layer,
                width,
                height,
                1,
                format === "r32f" ? gl.RED : gl.RGBA,
                format === "rgba8" ? gl.UNSIGNED_BYTE : gl.FLOAT,
                data,
            ),
        );
        engine._bindTextureDirectly(gl.TEXTURE_2D_ARRAY, null);
    }

    public copy(source: InternalTexture, target: InternalTexture, layers: number): boolean {
        if (this.format !== "rgba8") return false;
        const { engine, size } = this;
        const gl = engine._gl;
        // Copy each layer through a framebuffer, then restore the bindings Babylon expects.
        const previous = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        engine._bindTextureDirectly(gl.TEXTURE_2D_ARRAY, target, true);
        const resource = source._hardwareTexture?.underlyingResource as WebGLTexture | undefined;
        for (let layer = 0; resource && layer < layers; layer++) {
            gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, resource, 0, layer);
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) continue;
            gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, 0, 0, size, size);
        }
        engine._bindTextureDirectly(gl.TEXTURE_2D_ARRAY, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
        gl.deleteFramebuffer(framebuffer);
        return true;
    }

    /** Runs an upload with the default unpack state, then restores the state Babylon set. */
    private withUnpackDefaults(gl: WebGL2RenderingContext, upload: () => void): void {
        const flipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL) as boolean;
        const premultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) as boolean;
        const alignment = gl.getParameter(gl.UNPACK_ALIGNMENT) as number;
        if (flipY) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        if (premultiply) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        if (alignment !== 4) gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        try {
            upload();
        } finally {
            if (flipY) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            if (premultiply) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            if (alignment !== 4) gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);
        }
    }
}

/**
 * WebGPU texture arrays: created by Babylon with their views, written layer by layer through its texture helper, and
 * copied with `copyTextureToTexture` when the array grows, float layers included.
 */
export class WebGPUTextureArrayBackend implements ITextureArrayBackend {
    public constructor(
        private readonly engine: IWebGPUTextureEngine,
        private readonly size: number,
        private readonly format: TextureArrayFormat,
    ) {}

    public create(layers: number): InternalTexture {
        const { format, type, samplingMode } = formatConstants(this.format);
        return this.engine.createRawTexture2DArray(null, this.size, this.size, layers, format, false, false, samplingMode, null, type);
    }

    public write(
        texture: InternalTexture,
        layer: number,
        data: ArrayBufferView,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        const gpuFormat = (texture._hardwareTexture as { format?: string } | null)?.format;
        if (!gpuFormat) return;
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        // The face index is the array layer of a 2D array texture.
        this.engine._textureHelper.updateTexture(bytes, texture, width, height, 1, gpuFormat, layer, 0, false, false, x, y);
    }

    public copy(source: InternalTexture, target: InternalTexture, layers: number): boolean {
        const from = source._hardwareTexture?.underlyingResource;
        const to = target._hardwareTexture?.underlyingResource;
        if (!from || !to) return false;
        const device = this.engine._device;
        const encoder = device.createCommandEncoder();
        encoder.copyTextureToTexture(
            { texture: from },
            { texture: to },
            { width: this.size, height: this.size, depthOrArrayLayers: layers },
        );
        device.queue.submit([encoder.finish()]);
        return true;
    }
}

/** The backend of a texture array pool for the engine of a scene. */
export function createTextureArrayBackend(engine: AbstractEngine, size: number, format: TextureArrayFormat): ITextureArrayBackend {
    if (engine.isWebGPU) return new WebGPUTextureArrayBackend(engine as IWebGPUTextureEngine, size, format);
    const gl = (engine as Partial<IWebGL2TextureEngine>)._gl;
    if (typeof gl?.texStorage3D !== "function") throw new Error("TextureArrayPool requires a WebGL 2 or WebGPU engine.");
    return new WebGL2TextureArrayBackend(engine as IWebGL2TextureEngine, size, format);
}
