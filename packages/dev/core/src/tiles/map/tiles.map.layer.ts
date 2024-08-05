import { Observable, PropertyChangedEventArgs } from "../../events";
import { IsTileDatasource, ITile, ITileAddress, ITileCollection, ITileDatasource, ITileMetrics, ITileProvider, TileContentType } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerOptions, ITileMapLayerContainer, IHasTileMapLayerContainer, IsTileMapLayerContainerProxy, LayerRenderFn } from "./tiles.map.interfaces";

import { Assert } from "../../utils";
import { IMemoryCache } from "../../cache";
import { TileContentProvider } from "../pipeline";
import { TileProvider } from "../providers";

export class TileMapLayer<T> implements ITileMapLayer<T> {
    _name: string;
    _zindex: number;
    _zoomOffset: number;
    _attribution?: string;
    _enabled: boolean;
    _draw?: LayerRenderFn<T>;
    _drawTarget?: any;

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<unknown, unknown>>;

    _provider: ITileProvider<T>;

    public constructor(name: string, provider: ITileProvider<T> | ITileDatasource<T, ITileAddress>, options?: ITileMapLayerOptions<T>, enabled?: boolean) {
        Assert(name !== undefined && name !== null && name !== "", "Invalid layer name.");
        Assert(provider !== undefined && name !== null, "Invalid provider or datasource");

        this._name = name;
        this._provider = IsTileDatasource<T, ITileAddress>(provider) ? this._buildProvider(provider) : provider;
        this._zindex = options?.zindex ?? -1;
        this._zoomOffset = options?.zoomOffset ?? 0;
        this._attribution = options?.attribution;
        this._draw = options?.drawFn;
        this._drawTarget = options?.drawTarget ?? this;
        this._enabled = enabled ?? true; // default is enabled
    }

    public get activTiles(): ITileCollection<T> {
        return this._provider.activTiles;
    }

    public get metrics(): ITileMetrics {
        return this._provider.metrics;
    }

    public get provider(): ITileProvider<T> {
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

    public get name(): string {
        return this._name;
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

    public addTo(map: ITileMapLayerContainer<T, ITileMapLayer<T>> | IHasTileMapLayerContainer<T, ITileMapLayer<T>>): ITileMapLayer<T> {
        if (map) {
            if (IsTileMapLayerContainerProxy<T, ITileMapLayer<T>>(map)) {
                map = map.layerContainer;
            }
            map?.addLayer(this);
        }
        return this;
    }

    public dispose() {}

    protected _buildProvider(
        provider: ITileDatasource<T, ITileAddress>,
        cache?: IMemoryCache<string, TileContentType<T>>,
        type?: new (...args: any[]) => ITile<T>
    ): ITileProvider<T> {
        const contentProvider = new TileContentProvider<T>(provider, cache);
        const p = new TileProvider(contentProvider);
        if (type) p.factory.withType(type);
        return p;
    }
}
