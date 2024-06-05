import { Vector3 } from "@babylonjs/core";
import { IHasNavigationState, ITileMetrics, ITileNavigationState, hasNavigationState } from "core/tiles";
import { VirtualDisplay } from "../display";
import { ICartesian3 } from "core/geometry";
import { Observable, Observer, PropertyChangedEventArgs } from "core/events";
import { IDisposable, Nullable } from "core/types";
import { Geo2, IGeo2 } from "..";

export function HasMapScale(obj: unknown): obj is IHasMapScale {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasMapScale>obj).mapScale !== undefined;
}

export interface IHasMapScale {
    mapScale: ICartesian3;
}

export class Map3dScaleController implements IDisposable {
    public static DefaultThresholdLat: number = 0.01;

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
    private _currentCenter: IGeo2;
    private _thresholdLat: number = Map3dScaleController.DefaultThresholdLat;

    constructor(display: VirtualDisplay, nav: ITileNavigationState | IHasNavigationState, metrics: ITileMetrics) {
        this._display = display;
        this._nav = hasNavigationState(nav) ? nav.navigation : nav;
        this._metrics = metrics;
        this._observer = this._nav.propertyChangedObservable.add(this._onNavigationPropertyChanged.bind(this));
        this._currentCenter = this._nav.center?.clone() ?? Geo2.Zero();
    }

    public get thresholdLat(): number {
        return this._thresholdLat;
    }

    /// The threshold in degrees that triggers a scale change when the center changes ONLY in latitude for a given threshold.
    public set thresholdLat(v: number) {
        this._thresholdLat = v;
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
        if (this._thresholdExceeded(this._currentCenter, this._nav.center)) {
            this._currentCenter.lat = this._nav.center.lat;
            this._currentCenter.lon = this._nav.center.lon;
            this.scaleChangedObservable.notifyObservers(Map3dScaleController.GetScale(this._display, this._nav, this._metrics));
        }
    }

    protected _thresholdExceeded(a: IGeo2, b: IGeo2): boolean {
        return Math.abs(a.lat - b.lat) > this._thresholdLat;
    }
}
