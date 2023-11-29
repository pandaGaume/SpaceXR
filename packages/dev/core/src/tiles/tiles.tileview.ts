import { Geo2 } from "../geography/geography.position";
import { PropertyChangedEventArgs } from "../events/events.args";
import { Observable, Observer } from "../events/events.observable";
import { IEnvelope, IGeo2 } from "../geography/geography.interfaces";
import { ISize2 } from "../geometry/geometry.interfaces";
import { ITileMetrics } from "./tiles.interfaces";

import { ITileMapApi } from "./tiles.interfaces.api";
import { ITileView, TilePipelineEventArgs } from "./tiles.interfaces.pipeline";

export class TileView implements ITileView {
    _id?: string;
    _addressAddedObservable?: Observable<TilePipelineEventArgs>;
    _addressRemovedObservable?: Observable<TilePipelineEventArgs>;

    _resizeObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>>;
    _centerObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;
    _azimuthObservable?: Observable<PropertyChangedEventArgs<ITileMapApi, number>>;

    _metrics: ITileMetrics;

    // current navigation parameters
    _w: number;
    _h: number;
    _lodf: number;
    _lod: number;
    _bounds?: IEnvelope;
    _center: IGeo2;

    public constructor(metrics: ITileMetrics) {
        this._metrics = metrics;
        this._w = 0;
        this._h = 0;
        this._lodf = 0;
        this._lod = 0;
        this._center = Geo2.Zero();
    }

    public get id(): string | undefined {
        return this._id;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get addressAddedObservable(): Observable<TilePipelineEventArgs> {
        this._addressAddedObservable = this._addressAddedObservable || new Observable<TilePipelineEventArgs>(this.onAddressAddedObserverAdded.bind(this));
        return this._addressAddedObservable!;
    }

    public get addressRemovedObservable(): Observable<TilePipelineEventArgs> {
        this._addressRemovedObservable = this._addressRemovedObservable || new Observable<TilePipelineEventArgs>(this.onAddressRemovedObserverAdded.bind(this));
        return this._addressRemovedObservable!;
    }

    // MAP API
    public get resizeObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>> {
        this._resizeObservable = this._resizeObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, ISize2>>(this.onResizeObserverAdded.bind(this));
        return this._resizeObservable!;
    }

    public get centerObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>> {
        this._centerObservable = this._centerObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, IGeo2>>(this.onCenterObserverAdded.bind(this));
        return this._centerObservable!;
    }

    public get zoomObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>> {
        this._zoomObservable = this._zoomObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, number>>(this.onZoomObserverAdded.bind(this));
        return this._zoomObservable!;
    }

    public get azimuthObservable(): Observable<PropertyChangedEventArgs<ITileMapApi, number>> {
        this._azimuthObservable = this._azimuthObservable || new Observable<PropertyChangedEventArgs<ITileMapApi, number>>(this.onAzimuthObserverAdded.bind(this));
        return this._azimuthObservable!;
    }

    invalidateSize(w: number, h: number): ITileMapApi {
        throw new Error("Method not implemented.");
    }
    setView(center: IGeo2, zoom?: number | undefined, rotation?: number | undefined): ITileMapApi {
        throw new Error("Method not implemented.");
    }
    setZoom(zoom: number): ITileMapApi {
        throw new Error("Method not implemented.");
    }
    setAzimuth(r: number): ITileMapApi {
        throw new Error("Method not implemented.");
    }
    zoomIn(delta: number): ITileMapApi {
        throw new Error("Method not implemented.");
    }
    zoomOut(delta: number): ITileMapApi {
        throw new Error("Method not implemented.");
    }
    translate(tx: number, ty: number): ITileMapApi {
        throw new Error("Method not implemented.");
    }
    rotate(r: number): ITileMapApi {
        throw new Error("Method not implemented.");
    }

    // INTERNALS

    protected onResizeObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, ISize2>>): void {}
    private onZoomObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, number>>): void {}
    private onCenterObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, IGeo2>>): void {}
    private onAzimuthObserverAdded(observer: Observer<PropertyChangedEventArgs<ITileMapApi, number>>): void {}
    private onAddressAddedObserverAdded(observer: Observer<TilePipelineEventArgs>): void {}
    private onAddressRemovedObserverAdded(observer: Observer<TilePipelineEventArgs>): void {}
}
