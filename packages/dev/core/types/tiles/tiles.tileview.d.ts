import { Observable, Observer } from "../events/events.observable";
import { IGeo2 } from "../geography/geography.interfaces";
import { ISize2 } from "../geometry/geometry.interfaces";
import { ITileAddress, ITileMetrics } from "./tiles.interfaces";
import { ITileView, TilePipelineEventArgs } from "./tiles.interfaces.pipeline";
import { TileMapBase, TileMapContextMetrics } from "./tiles.tilemap";
export declare class TileView extends TileMapBase implements ITileView {
    _id?: string;
    _addressAddedObservable?: Observable<TilePipelineEventArgs>;
    _addressRemovedObservable?: Observable<TilePipelineEventArgs>;
    _activ: Map<string, ITileAddress>;
    constructor(id: string, metrics: ITileMetrics, size?: ISize2, center?: IGeo2, lod?: number, azimuth?: number);
    get id(): string | undefined;
    get addressAddedObservable(): Observable<TilePipelineEventArgs>;
    get addressRemovedObservable(): Observable<TilePipelineEventArgs>;
    protected _doValidate(): void;
    protected _doValidateContext(context: TileMapContextMetrics, dispatchEvent?: boolean): void;
    protected _onAddressAddedObserverAdded(observer: Observer<TilePipelineEventArgs>): void;
    protected _onAddressRemovedObserverAdded(observer: Observer<TilePipelineEventArgs>): void;
}
