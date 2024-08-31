import { Observable, PropertyChangedEventArgs } from "../../events";
import { IsTileDatasource, ITileAddress, ITileContentProvider, ITileDatasource, ITileMetrics, TileContentType } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerOptions, ITileMapLayerContainer, IHasTileMapLayerContainer, IsTileMapLayerContainerProxy, LayerRenderFn } from "./tiles.map.interfaces";

import { Assert } from "../../utils";
import { IMemoryCache } from "../../cache";
import { TileContentProvider } from "../providers";
import { IWeighted } from "../../collections/collections.interfaces";

export class TileMapLayer<T> implements ITileMapLayer<T> {
    _name: string;
    _weight: number;
    _zoomOffset: number;
    _attribution?: string;
    _enabled: boolean;
    _draw?: LayerRenderFn<T>;
    _drawTarget?: any;

    _weightChangedObservable?: Observable<IWeighted>;
    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<unknown, unknown>>;

    _provider: ITileContentProvider<T>;

    public constructor(name: string, provider: ITileContentProvider<T> | ITileDatasource<T, ITileAddress>, options?: ITileMapLayerOptions<T>, enabled?: boolean) {
        Assert(name !== undefined && name !== null && name !== "", "Invalid layer name.");
        Assert(provider !== undefined && name !== null, "Invalid provider or datasource");

        this._name = name;
        this._provider = IsTileDatasource<T, ITileAddress>(provider) ? this._buildProvider(provider) : provider;
        this._weight = options?.weight ?? -1;
        this._zoomOffset = options?.zoomOffset ?? 0;
        this._attribution = options?.attribution;
        this._draw = options?.drawFn;
        this._drawTarget = options?.drawTarget ?? this;
        this._enabled = enabled ?? true; // default is enabled
    }

    public get metrics(): ITileMetrics {
        return this._provider.metrics;
    }

    public get provider(): ITileContentProvider<T> {
        return this._provider;
    }

    public get drawFn(): LayerRenderFn<T> | undefined {
        return this._draw;
    }

    public get drawTarget(): any {
        return this._drawTarget;
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<unknown, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<unknown, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    public get weightChangedObservable(): Observable<IWeighted> {
        if (!this._weightChangedObservable) {
            this._weightChangedObservable = new Observable<IWeighted>();
        }
        return this._weightChangedObservable;
    }

    public get name(): string {
        return this._name;
    }

    public get weight(): number {
        return this._weight;
    }

    public set weight(zindex: number) {
        if (this._weight !== zindex) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._weight;
                this._weight = zindex;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._weight, "weight");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            if (this._weightChangedObservable && this._weightChangedObservable.hasObservers()) {
                this._weightChangedObservable.notifyObservers(this, -1, this, this);
            }
            this._weight = zindex;
        }
    }

    public get zoomOffset(): number {
        return this._zoomOffset ?? 0;
    }

    public set zoomOffset(zoomOffset: number) {
        if (this._zoomOffset !== zoomOffset) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._zoomOffset;
                this._zoomOffset = zoomOffset;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._zoomOffset, "zoomOffset");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._zoomOffset = zoomOffset;
        }
    }

    public get attribution(): string | undefined {
        return this._attribution;
    }

    public set attribution(attribution: string | undefined) {
        if (this._attribution !== attribution) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._attribution;
                this._attribution = attribution;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._attribution, "attribution");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._attribution = attribution;
        }
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(enabled: boolean) {
        if (this._enabled !== enabled) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._enabled;
                this._enabled = enabled;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._enabled, "enabled");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._enabled = enabled;
        }
    }

    public addTo(map: ITileMapLayerContainer<T> | IHasTileMapLayerContainer<T>): ITileMapLayer<T> {
        if (map) {
            if (IsTileMapLayerContainerProxy<T>(map)) {
                map = map.layers;
            }
            map?.add(this);
        }
        return this;
    }

    public dispose() {}

    protected _buildProvider(dataSource: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContentType<T>>): ITileContentProvider<T> {
        return new TileContentProvider<T>(dataSource, cache);
    }
}
