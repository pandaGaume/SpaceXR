import { IMemoryCache } from "core/cache";
import { Observable, PropertyChangedEventArgs } from "../../events";
import { TileProvider } from "../providers/tiles.provider";
import { TileContentProvider } from "../providers/tiles.provider.content";

import { ITileAddress, ITileDatasource, ITileMetrics, ITileProvider, IsTileDatasource, TileContent } from "../tiles.interfaces";
import { ITileMap, ITileMapLayer, ITileMapLayerOptions } from "./tiles.map.interfaces";

export class TileMapLayer<T> implements ITileMapLayer<T> {
    _propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileMapLayer<T>, unknown>> | undefined;
    _name: string;
    _provider: ITileProvider<T>;
    _zindex: number;
    _alpha: number;
    _zoomOffset?: number;
    _attribution?: string;
    _enabled: boolean;

    public constructor(name: string, provider: ITileProvider<T> | ITileDatasource<T, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean) {
        this._name = name;
        if (IsTileDatasource<T, ITileAddress>(provider)) {
            provider = this._buildProvider(provider);
        }
        if (!provider) throw new Error("Invalid provider or datasource");

        this._provider = provider;
        this._zindex = options?.zindex ?? -1;
        this._alpha = options?.alpha !== undefined ? Math.min(Math.max(options?.alpha, 0), 1.0) : 1.0; // default is opaque
        this._zoomOffset = options?.zoomOffset !== undefined ? options?.zoomOffset : 0;
        this._attribution = options?.attribution;
        this._enabled = enabled ?? true; // default is enabled
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileMapLayer<T>, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileMapLayer<T>, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    public get metrics(): ITileMetrics {
        return this._provider.metrics;
    }

    public get name(): string {
        return this._name;
    }

    public set name(name: string) {
        if (this._name !== name) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._name;
                this._name = name;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._name, "name");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._name = name;
        }
    }

    public get provider(): ITileProvider<T> {
        return this._provider;
    }

    public get zindex(): number {
        return this._zindex;
    }

    public set zindex(zindex: number) {
        if (this._zindex !== zindex) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._zindex;
                this._zindex = zindex;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._zindex, "zindex");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._zindex = zindex;
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

    public get alpha(): number {
        return this._alpha;
    }

    public set alpha(alpha: number) {
        const a = Math.min(Math.max(alpha, 0), 1.0);
        if (this._alpha !== a) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._alpha;
                this._alpha = a;
                const args = new PropertyChangedEventArgs<ITileMapLayer<T>, unknown>(this, oldValue, this._alpha, "alpha");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._alpha = a;
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

    public addTo(map: ITileMap<T>): ITileMapLayer<T> {
        map.addLayer(this);
        return this;
    }

    protected _buildProvider(provider: ITileDatasource<T, ITileAddress>, cache?: IMemoryCache<string, TileContent<T>>): ITileProvider<T> {
        const contentProvider = new TileContentProvider<T>(provider, cache);
        return new TileProvider(contentProvider);
    }
}
