import * as BABYLON from "@babylonjs/core";
import { CanvasDisplay, CanvasMap, ICanvasMapOptions } from "core/map/canvas";
import { ITileNavigationState } from "core/tiles";
import { ISize2 } from "core/geometry";
import { EventState } from "core/events";
export interface IMapTextureOptions extends ICanvasMapOptions, ISize2 {
    generateMipMaps?: boolean;
    samplingMode?: number;
    format?: number;
    invertY?: boolean;
}
export declare class WebMapTexture extends BABYLON.Texture {
    static readonly DefaultOptions: IMapTextureOptions;
    static Options(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    static OptionsHD(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    static OptionsFullHD(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    static Options4K(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    static Options8K(o?: Partial<IMapTextureOptions>): IMapTextureOptions;
    _display: BABYLON.Nullable<CanvasDisplay>;
    _map: BABYLON.Nullable<CanvasMap<unknown>>;
    _renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Camera>>;
    constructor(name: string, options: IMapTextureOptions, scene: BABYLON.Scene, nav?: ITileNavigationState);
    get map(): CanvasMap<unknown>;
    dispose(): void;
    protected _checkUpdate(camera: BABYLON.Camera, eventState: EventState): void;
}
