import { Vector3 } from "@babylonjs/core";
import { IHasNavigationState, ITileMetrics, ITileNavigationState, hasNavigationState } from "core/tiles";
import { VirtualDisplay } from "../display";
import { ICartesian3 } from "core/geometry";
import { Observable, Observer, PropertyChangedEventArgs } from "core/events";
import { IDisposable, Nullable } from "core/types";


export function hasMapScale(obj: unknown): obj is IHasMapScale {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasMapScale>obj).mapScale !== undefined;
}

export interface IHasMapScale{
    mapScale: ICartesian3;
}


export class Map3dScaleController implements IDisposable {
    public static GetScale(display: VirtualDisplay, nav: ITileNavigationState, metrics: ITileMetrics): ICartesian3 {
        const x = metrics.mapScale(nav.center.lat, nav.lod, display.pixelPerUnit.x);
        const y = metrics.mapScale(nav.center.lat, nav.lod, display.pixelPerUnit.y);
        const z = metrics.mapScale(nav.center.lat, nav.lod, display.pixelPerUnit.z);
        return new Vector3(x, y, z);
    }

    private _scaleChangedOnservable?: Observable<ICartesian3>;
    private _observer: Nullable<Observer<PropertyChangedEventArgs<ITileNavigationState, unknown>>>;

    private _display: VirtualDisplay;
    private _nav: ITileNavigationState;
    private _metrics: ITileMetrics;

    constructor(display: VirtualDisplay, nav: ITileNavigationState | IHasNavigationState, metrics: ITileMetrics) {
        this._display = display;
        this._nav = hasNavigationState(nav) ? nav.navigation : nav;
        this._metrics = metrics;
        this._observer = this._nav.propertyChangedObservable.add(this._onNavigationPropertyChanged.bind(this));
    }

    public get scaleChangedObservable(): Observable<ICartesian3> {
        if (!this._scaleChangedOnservable) {
            this._scaleChangedOnservable = new Observable<ICartesian3>();
        }
        return this._scaleChangedOnservable;
    }

    public dispose() {
        this._observer?.disconnect();
        this._observer = null;
    }

    protected _onNavigationPropertyChanged(e: PropertyChangedEventArgs<ITileNavigationState, unknown>): void {
        switch (e.propertyName) {
            case "zoom": {
                this._onZoomChanged();
                break;
            }
            case "center": {
                this._onCenterChanged();
                break;
            }
        }
    }

    protected _onZoomChanged(): void {
        this.scaleChangedObservable.notifyObservers(Map3dScaleController.GetScale(this._display, this._nav, this._metrics));
    }

    protected _onCenterChanged(): void {
        this.scaleChangedObservable.notifyObservers(Map3dScaleController.GetScale(this._display, this._nav, this._metrics));
    }
}
