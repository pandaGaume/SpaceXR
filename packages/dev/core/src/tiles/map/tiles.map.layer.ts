import { Observable, PropertyChangedEventArgs } from "core/events";
import { ITileProvider } from "../tiles.interfaces";
import { ITileMapLayer } from "./tiles.map.interfaces";

export class TileMapLayer<T> implements ITileMapLayer<T> {
    _propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileMapLayer<T>, unknown>> | undefined;
    _name: string;
    _provider: ITileProvider<T>;
    _zindex: number;
    _alpha: number;
    _enabled: boolean;

    public constructor(name: string, provider: ITileProvider<T>, zindex?: number, alpha?: number, enabled?: boolean) {
        this._name = name;
        this._provider = provider;
        this._zindex = zindex ?? -1;
        this._alpha = alpha !== undefined ? Math.min(Math.max(alpha, 0), 1.0) : 1.0; // default is opaque
        this._enabled = enabled ?? true; // default is enabled
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileMapLayer<T>, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileMapLayer<T>, unknown>>();
        }
        return this._propertyChangedObservable;
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
}
