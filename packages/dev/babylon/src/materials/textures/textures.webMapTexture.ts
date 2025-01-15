import * as BABYLON from "@babylonjs/core";
import { CanvasDisplay, CanvasMap, ICanvasMapOptions } from "core/map/canvas";
import { ITileNavigationState } from "core/tiles";

import { ISize2 } from "core/geometry";
import { EventState } from "core/events";
import { Assert } from "core/utils";

export interface IMapTextureOptions extends ICanvasMapOptions, ISize2 {
    generateMipMaps?: boolean;
    samplingMode?: number;
    format?: number;
    invertY?: boolean;
}

/**
 * Provide Babylon js Texture implementation for a 2D WebMap (Web Mercator projection).
 */
export class WebMapTexture extends BABYLON.Texture {
    static readonly DefaultOptions: IMapTextureOptions = {
        width: 1024,
        height: 768,
        generateMipMaps: false,
        samplingMode: BABYLON.Constants.TEXTURE_TRILINEAR_SAMPLINGMODE,
        format: BABYLON.Constants.TEXTUREFORMAT_RGBA,
        invertY: false,
    };

    public static Options(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...WebMapTexture.DefaultOptions, ...(o ?? {}) };
    }
    public static OptionsHD(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...WebMapTexture.DefaultOptions, ...(o ?? {}), width: 1280, height: 720 };
    }
    public static OptionsFullHD(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...WebMapTexture.DefaultOptions, ...(o ?? {}), width: 1980, height: 1080 };
    }
    public static Options4K(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...WebMapTexture.DefaultOptions, ...(o ?? {}), width: 3840, height: 2160 };
    }
    public static Options8K(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...WebMapTexture.DefaultOptions, ...(o ?? {}), width: 7680, height: 4320 };
    }

    _display: BABYLON.Nullable<CanvasDisplay>;
    _map: BABYLON.Nullable<CanvasMap<unknown>>;
    _renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Camera>>;

    public constructor(name: string, options: IMapTextureOptions, scene: BABYLON.Scene, nav?: ITileNavigationState) {
        const o = { ...WebMapTexture.DefaultOptions, ...options };

        super(null, scene, !o.generateMipMaps, o.invertY, o.samplingMode, undefined, undefined, undefined, undefined, o.format);

        // preliminary setup
        this._display = null;
        this._map = null;
        this._renderObserver = null;

        // texture setup
        this.name = name;
        this.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
        this.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

        const engine = this._getEngine();
        Assert(engine !== null, "unable to get engine");

        const canvas = engine.createCanvas(options.width, options.height);
        Assert(canvas !== null && canvas != undefined, "unable to create canvas");

        this._texture = engine.createDynamicTexture(options.width, options.height, o.generateMipMaps!, o.samplingMode!);
        this._display = new CanvasDisplay(canvas as HTMLCanvasElement, 1, false); // do NOT automatically resize the canvas to the client size.
        this._map = new CanvasMap(this._display, o, nav);
        this._renderObserver = scene.onBeforeCameraRenderObservable.add(this._checkUpdate.bind(this));
    }

    public get map(): CanvasMap<unknown> {
        return this._map!;
    }

    public dispose() {
        super.dispose();
        if (this._renderObserver) {
            this.getScene()?.onBeforeCameraRenderObservable.remove(this._renderObserver);
        }
        this._map?.dispose();
        this._display?.dispose();
    }

    // rendering related
    protected _checkUpdate(camera: BABYLON.Camera, eventState: EventState): void {
        if (this._map && this._display) {
            if (this._map.isValid == false) {
                this._map.validate();
                this._getEngine()!.updateDynamicTexture(this._texture, this._display.canvas, this._invertY, false, this._format || undefined, undefined, false);
            }
        }
    }
}
