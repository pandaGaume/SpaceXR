import { Observable, Observer } from "../events/events.observable";
import { IGeo2 } from "../geography/geography.interfaces";
import { ISize2 } from "../geometry/geometry.interfaces";
import { ITileMetrics } from "./tiles.interfaces";
import { ITileView, TilePipelineEventArgs } from "./tiles.interfaces.pipeline";
import { TileMapBase } from "./tiles.tilemap";

export class TileView extends TileMapBase implements ITileView {
    _id?: string;
    _addressAddedObservable?: Observable<TilePipelineEventArgs>;
    _addressRemovedObservable?: Observable<TilePipelineEventArgs>;

    public constructor(metrics: ITileMetrics, size?: ISize2, center?: IGeo2, lod?: number, azimuth?: number) {
        super(metrics, size, center, lod, azimuth);
    }

    public get id(): string | undefined {
        return this._id;
    }

    public get addressAddedObservable(): Observable<TilePipelineEventArgs> {
        this._addressAddedObservable = this._addressAddedObservable || new Observable<TilePipelineEventArgs>(this._onAddressAddedObserverAdded.bind(this));
        return this._addressAddedObservable!;
    }

    public get addressRemovedObservable(): Observable<TilePipelineEventArgs> {
        this._addressRemovedObservable = this._addressRemovedObservable || new Observable<TilePipelineEventArgs>(this._onAddressRemovedObserverAdded.bind(this));
        return this._addressRemovedObservable!;
    }

    // INTERNALS
    protected _doValidate() {
        // this is the place where we validate the view and compute the visible tile addresses
    }

    protected _onAddressAddedObserverAdded(observer: Observer<TilePipelineEventArgs>): void {}
    protected _onAddressRemovedObserverAdded(observer: Observer<TilePipelineEventArgs>): void {}
}
