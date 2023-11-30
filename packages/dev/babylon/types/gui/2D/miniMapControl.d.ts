import { TileMapView } from "core/tiles/tiles.mapview";
import { View } from "./view";
import { IViewSkin } from "../skin";
import { TileContentProvider } from "core/tiles/tiles.provider.content";
import { ITileDatasource, ITileAddress } from "core/tiles/tiles.interfaces";
import { ISize2 } from "core/geometry/geometry.interfaces";
import { IMemoryCache } from "core/utils/cache";
import { Measure } from "@babylonjs/gui";
import { ICanvasRenderingContext } from "@babylonjs/core";
type MinimapModelType = TileMapView<any>;
type MinimapSkinType = IViewSkin;
export declare class MiniMapControlOptions {
    resolution?: ISize2;
    provider?: TileContentProvider<HTMLImageElement>;
    source?: ITileDatasource<HTMLImageElement, ITileAddress>;
    cache?: IMemoryCache<string, HTMLImageElement>;
}
export declare class MiniMapControl extends View<MinimapModelType, MinimapSkinType> {
    private static CreateDefaultSkin;
    private _centerObserver?;
    private _zoomObserver?;
    private _azimuthObserver?;
    private _map?;
    private _window?;
    constructor(name: string, options: MiniMapControlOptions, model?: TileMapView<any>, skin?: IViewSkin);
    protected _onModelChanged(oldValue: MinimapModelType | undefined, newValue: MinimapModelType | undefined): void;
    private _onCenterChanged;
    private _onZoomChanged;
    private _onAzimuthChanged;
    protected _createContent(model?: MinimapModelType, skin?: MinimapSkinType, options?: any): void;
    protected _updateContent(oldValue: MinimapModelType | undefined, newValue: MinimapModelType | undefined): void;
    protected _additionalProcessing(parentMeasure: Measure, context: ICanvasRenderingContext): void;
    protected _updateWindowSize(model?: MinimapModelType): void;
}
export {};
