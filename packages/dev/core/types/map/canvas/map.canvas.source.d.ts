import { ICanvasRenderingContext, ICanvasRenderingOptions } from "../../engine";
import { EventState, Observer, PropertyChangedEventArgs } from "../../events";
import { IEnvelope, IGeoBounded } from "../../geography";
import { ISize2 } from "../../geometry";
import { RGBAColor } from "../../math";
import { ITile, ITileAddress, ITileMetrics, ITileMetricsProvider, TileCollection, TileConsumerBase } from "../../tiles";
import { ITileMapLayer, ITileMapLayerContainer, ImageLayerContentType } from "../../tiles/map";
import { Nullable } from "../../types";
import { CanvasDisplay } from "./map.canvas.display";
export type CanvasTileSourceTargetContentType = ImageLayerContentType;
export type CanvasTileSourceSourceContentType = any;
declare class LayerView {
    layer: ITileMapLayer<CanvasTileSourceSourceContentType>;
    tiles: TileCollection<CanvasTileSourceSourceContentType>;
    propertyChangedObserver: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>>;
    constructor(layer: ITileMapLayer<CanvasTileSourceSourceContentType>, tiles: TileCollection<CanvasTileSourceSourceContentType>, propertyChangedObserver?: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>>);
}
export interface ICanvasTileSourceOptions extends ICanvasRenderingOptions {
    resolution?: ISize2;
    display?: HTMLCanvasElement | CanvasDisplay;
    debug?: boolean;
}
export declare class CanvasTileSource<L extends ITileMapLayer<CanvasTileSourceSourceContentType>> extends TileConsumerBase<CanvasTileSourceTargetContentType> implements ICanvasRenderingOptions, ITileMetricsProvider, IGeoBounded {
    static DefaultBackground: RGBAColor;
    static DefaultOptions: ICanvasRenderingOptions;
    _target: ITile<ImageData>;
    _metrics: ITileMetrics;
    _layers: ITileMapLayerContainer<CanvasTileSourceSourceContentType, L>;
    _layerAddedObservable?: Nullable<Observer<L>>;
    _layerRemovedObservable?: Nullable<Observer<L>>;
    _activeTiles: Array<LayerView>;
    _display: CanvasDisplay;
    _context: Nullable<CanvasRenderingContext2D>;
    _background?: string;
    _alpha: number;
    _debug: boolean;
    constructor(name: string, layers: ITileMapLayerContainer<CanvasTileSourceSourceContentType, L>, target: ITile<ImageData> | ITileAddress, metrics: ITileMetrics, options?: ICanvasTileSourceOptions);
    get debug(): boolean;
    set debug(value: boolean);
    get target(): ITile<ImageData>;
    get display(): CanvasDisplay;
    get metrics(): ITileMetrics;
    get background(): string | undefined;
    set background(v: string | undefined);
    get alpha(): number;
    set alpha(v: number);
    get geoBounds(): IEnvelope | undefined;
    protected _onLayerAdded(layer: L): void;
    protected _onLayerPropertyChanged(eventData: PropertyChangedEventArgs<unknown, unknown>, eventState: EventState): void;
    protected _onLayerRemoved(layer: L): void;
    dispose(): void;
    protected _onBeforeTileAdded(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void;
    protected _onTileAdded(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void;
    protected _onBeforeTileRemoved(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void;
    protected _onTileRemoved(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void;
    protected _onBeforeTileUpdated(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void;
    protected _onTileUpdated(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void;
    protected _doValidate(): void;
    protected _afterValidate(): void;
    protected _getContext2D(): Nullable<CanvasRenderingContext2D>;
    protected _draw(ctx: ICanvasRenderingContext, xoffset?: number, yoffset?: number): void;
    protected _buildDisplay(options?: ICanvasTileSourceOptions): CanvasDisplay;
}
export {};
