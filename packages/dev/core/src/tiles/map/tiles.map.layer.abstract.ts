import { PropertyChangedEventArgs } from "../../events";

import { ITileCollection, ITileMetrics } from "../tiles.interfaces";
import { ITileMapLayer, ITileMapLayerOptions, ITileMapLayerContainer, IHasTileMapLayerContainer, IsTileMapLayerContainerProxy } from "./tiles.map.interfaces";
import { TileConsumerBase } from "../pipeline";
import { Nullable } from "../../types";
import { ITileNavigationState, TileNavigationState } from "../navigation";
import { ISize2 } from "../../geometry";

export abstract class AbstractTileMapLayer<T> extends TileConsumerBase<T> implements ITileMapLayer<T> {
    _zindex: number;

    _zoomOffset?: number;
    _attribution?: string;
    _enabled: boolean;
    _state: ITileNavigationState;

    public constructor(name: string, options?: ITileMapLayerOptions, enabled?: boolean, navigation?: ITileNavigationState) {
        super(name);
        this._zindex = options?.zindex ?? -1;
        this._zoomOffset = options?.zoomOffset !== undefined ? options?.zoomOffset : 0;
        this._attribution = options?.attribution;
        this._enabled = enabled ?? true; // default is enabled
        this._state = navigation ?? new TileNavigationState();
    }

    public setContext(state: Nullable<ITileNavigationState>, display: Nullable<ISize2>, metrics?: ITileMetrics, dispatchEvent: boolean = true): void {
        if (state) {
            this._state?.setViewMap(state.center, state.zoom + this.zoomOffset, state.azimuth.value).validate();
        }
    }

    public get zindex(): number {
        return this._zindex;
    }

    public get navigation(): ITileNavigationState {
        return this._state;
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

    public dispose() {
        super.dispose();
    }

    public abstract get metrics(): ITileMetrics;
    public abstract get activTiles(): ITileCollection<T>;
}
