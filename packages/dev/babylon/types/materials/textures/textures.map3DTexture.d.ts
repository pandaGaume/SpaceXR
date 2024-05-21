import { ITexture3CreationOptions, ITexture3Layer, Texture3 } from "babylon_ext/Materials";
import { ICanvas, Nullable, Scene } from "@babylonjs/core";
import { ITile, ITileMetrics, ITileNavigationState, ImageLayer } from "core/tiles";
import { IDemInfos } from "core/dem";
import { IDisposable } from "core/types";
import { ICanvasRenderingContext } from "core/engine";
import { CanvasDisplay } from "core/map";
import { ICartesian2 } from "core/geometry";
import { ElevationLayer, IMap3dElevationTarget, IMap3dImageTarget } from "../../map";
import { IGeo2 } from "core/geography";
import { Observable } from "core/events";
declare class ImageLayerView {
    source: ImageLayer;
    tiles: Array<ITile<HTMLImageElement>>;
    constructor(layer: ImageLayer);
    add(tile: ITile<HTMLImageElement>): void;
    remove(tile: ITile<HTMLImageElement>): void;
    draw(ctx: ICanvasRenderingContext, center?: ICartesian2): void;
}
declare class Map3dTextureItem implements IDisposable {
    isDirty: boolean;
    elevationLayer: ElevationLayer;
    elevationTile: ITile<IDemInfos>;
    display: CanvasDisplay;
    textureTarget: ITexture3Layer;
    views: Array<ImageLayerView>;
    _metrics: ITileMetrics;
    _nav: ITileNavigationState;
    _geo: IGeo2;
    context: Nullable<CanvasRenderingContext2D>;
    constructor(layer: ElevationLayer, elevation: ITile<IDemInfos>, target: ITexture3Layer, display: CanvasDisplay);
    addTile(layer: ImageLayer, tile: ITile<HTMLImageElement>): void;
    removeTile(layer: ImageLayer, tile: ITile<HTMLImageElement>): void;
    update(layer: ITile<HTMLImageElement>): void;
    dispose(): void;
    validate(): void;
    protected _draw(ctx: ICanvasRenderingContext, x: number, y: number, w: number, h: number): void;
    protected _getTileCenter(): ICartesian2;
    protected _doValidate(): void;
}
export declare class ElevationTileAddedEventArgs {
    tile: ITile<IDemInfos>;
    depth: number;
    constructor(tile: ITile<IDemInfos>, depth: number);
}
export declare class Map3dTexture extends Texture3 implements IMap3dElevationTarget, IMap3dImageTarget {
    _items: Map<string, Map3dTextureItem>;
    _sharedDisplay?: CanvasDisplay;
    _beforeRenderMethod: () => void;
    _elevationTileReady?: Observable<ElevationTileAddedEventArgs>;
    constructor(scene: Scene, options: ITexture3CreationOptions);
    elevationTileReadyObservable(): Observable<ElevationTileAddedEventArgs>;
    dispose(): void;
    getTextureDepth(quadkey: string): number;
    demAdded(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    demRemoved(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    demUpdated(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    imageAdded(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageRemoved(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    imageUpdated(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    protected _selectItems(delegate?: (i: Map3dTextureItem) => boolean): IterableIterator<Map3dTextureItem>;
    protected _beforeRender(): void;
    protected _createDisplay(canvas?: ICanvas): CanvasDisplay | undefined;
    protected _createCanvas(): ICanvas | undefined;
}
export {};
