import * as BABYLON from "@babylonjs/core";
import { CanvasDisplay, CanvasMap, ICanvasRenderingOptions } from "core/map/canvas";
import { IImageTileMapLayer, ITileMap, ITileMetrics, ITileNavigationApi, ITileNavigationState, ImageLayer } from "core/tiles";

import { ISize2 } from "core/geometry";
import { IGeo2 } from "core/geography";
import { EventState, Observable } from "core/events";

export interface IMapTextureOptions extends ICanvasRenderingOptions, ISize2 {
    generateMipMaps?: boolean;
    samplingMode?: number;
    format?: number;
    invertY?: boolean;
}

export class MapTexture extends BABYLON.Texture implements ITileNavigationApi<MapTexture>, ITileMap<HTMLImageElement, IImageTileMapLayer> {
    static readonly DefaultOptions: IMapTextureOptions = {
        width: 1024,
        height: 768,
        generateMipMaps: false,
        samplingMode: BABYLON.Constants.TEXTURE_TRILINEAR_SAMPLINGMODE,
        format: BABYLON.Constants.TEXTUREFORMAT_RGBA,
        invertY: false,
    };

    public static Options(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...MapTexture.DefaultOptions, ...(o ?? {}) };
    }
    public static OptionsHD(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...MapTexture.DefaultOptions, ...(o ?? {}), width: 1280, height: 720 };
    }
    public static OptionsFullHD(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...MapTexture.DefaultOptions, ...(o ?? {}), width: 1980, height: 1080 };
    }
    public static Options4K(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...MapTexture.DefaultOptions, ...(o ?? {}), width: 3840, height: 2160 };
    }
    public static Options8K(o?: Partial<IMapTextureOptions>): IMapTextureOptions {
        return { ...MapTexture.DefaultOptions, ...(o ?? {}), width: 7680, height: 4320 };
    }

    _display: BABYLON.Nullable<CanvasDisplay>;
    _map: BABYLON.Nullable<CanvasMap>;
    _renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Camera>>;

    public constructor(name: string, options: IMapTextureOptions, scene: BABYLON.Scene, nav?: ITileNavigationState) {
        const o = { ...MapTexture.DefaultOptions, ...options };

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
        if (engine) {
            const canvas = engine.createCanvas(options.width, options.height);

            if (canvas) {
                this._texture = engine.createDynamicTexture(options.width, options.height, o.generateMipMaps!, o.samplingMode!);
                this._display = new CanvasDisplay(canvas as HTMLCanvasElement, 1, false); // do NOT automatically resize the canvas to the client size.
                this._map = new CanvasMap(name, this._display, o, nav);
                this._renderObserver = scene.onBeforeCameraRenderObservable.add(this._checkUpdate.bind(this));
            }
        }
    }

    public get map(): BABYLON.Nullable<CanvasMap> {
        return this._map;
    }
    // navigation related
    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): MapTexture {
        if (!this._map) throw new Error("Invalid State");
        this._map.setViewMap(center, zoom, rotation);
        return this;
    }

    public zoomMap(delta: number): MapTexture {
        if (!this._map) throw new Error("Invalid State");
        this._map.zoomMap(delta);
        return this;
    }

    public zoomInMap(delta: number): MapTexture {
        if (!this._map) throw new Error("Invalid State");
        this._map.zoomInMap(delta);
        return this;
    }
    public zoomOutMap(delta: number): MapTexture {
        if (!this._map) throw new Error("Invalid State");
        this._map.zoomOutMap(delta);
        return this;
    }
    public translatePixelMap(tx: number, ty: number, metrics?: ITileMetrics): MapTexture {
        if (!this._map) throw new Error("Invalid State");
        this._map.translatePixelMap(tx, ty, metrics);
        return this;
    }
    public translateMap(lat: IGeo2 | Array<number> | number, lon?: number): MapTexture {
        if (!this._map) throw new Error("Invalid State");
        this._map.translateMap(lat, lon);
        return this;
    }
    public rotateMap(r: number): MapTexture {
        if (!this._map) throw new Error("Invalid State");
        this._map.rotateMap(r);
        return this;
    }

    public get navigation(): ITileNavigationState {
        if (!this._map) throw new Error("Invalid State");
        return this._map.navigation;
    }

    public get display(): BABYLON.Nullable<CanvasDisplay> {
        return this._display;
    }

    // map related
    public get layerAddedObservable(): Observable<IImageTileMapLayer> {
        if (!this._map) throw new Error("Invalid State");
        return this._map.layerAddedObservable;
    }

    public get layerRemovedObservable(): Observable<IImageTileMapLayer> {
        if (!this._map) throw new Error("Invalid State");
        return this._map.layerRemovedObservable;
    }

    public getLayers(predicate?: (l: IImageTileMapLayer) => boolean, sorted?: boolean): IterableIterator<IImageTileMapLayer> {
        if (!this._map) throw new Error("Invalid State");
        return this._map.getLayers(predicate, sorted);
    }

    public addLayer(layer: ImageLayer): void {
        if (!this._map) throw new Error("Invalid State");
        this._map.addLayer(layer);
    }

    public removeLayer(layer: ImageLayer): void {
        if (!this._map) throw new Error("Invalid State");
        this._map.removeLayer(layer);
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
