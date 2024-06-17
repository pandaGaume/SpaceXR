import { IMemoryCache } from "../../cache";
import { EventState, Observer, PropertyChangedEventArgs } from "../../events";
import { ITile, ITileAddress, ITileCollection, ITileDatasource, ITileMetrics, ITileProvider, TileContentType } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerOptions } from "./tiles.map.interfaces";
import { ITilePipeline, ITileView } from "../pipeline";
import { Nullable } from "../../types";
import { ITileNavigationState } from "../navigation";
import { AbstractTileMapLayer } from "./tiles.map.layer.abstract";
import { ISize2 } from "../../geometry";
export declare class TileMapLayer<T> extends AbstractTileMapLayer<T> implements ITileMapLayer<T> {
    protected _pipeline: ITilePipeline<T>;
    _pipelinePropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<ITilePipeline<T>, unknown>>>;
    _provider: ITileProvider<T>;
    constructor(name: string, provider: ITileProvider<T> | ITileDatasource<T, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean);
    setContext(state: Nullable<ITileNavigationState>, display: Nullable<ISize2>, metrics?: ITileMetrics, dispatchEvent?: boolean): void;
    get metrics(): ITileMetrics;
    get provider(): ITileProvider<T>;
    dispose(): void;
    get activTiles(): ITileCollection<T>;
    protected _buildProvider(provider: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContentType<T>>, type?: new (...args: any[]) => ITile<T>): ITileProvider<T>;
    protected _buildPipeline(provider: ITileProvider<T>): ITilePipeline<T>;
    protected _buildView(): ITileView;
    protected _onPipelinePropertyChanged(event: PropertyChangedEventArgs<ITilePipeline<T>, unknown>, state: EventState): void;
}
