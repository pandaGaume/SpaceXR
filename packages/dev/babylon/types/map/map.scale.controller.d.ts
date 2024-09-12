import { IHasNavigationState, IPhysicalDisplay, ITileMetrics, ITileNavigationState } from "core/tiles";
import { ICartesian3 } from "core/geometry";
import { Observable, PropertyChangedEventArgs } from "core/events";
import { IDisposable } from "core/types";
import { IGeo2 } from "core/geography";
export declare function HasMapScale(obj: unknown): obj is IHasMapScale;
export interface IHasMapScale {
    mapScale: ICartesian3;
}
export declare class Map3DScaleController implements IDisposable {
    static DefaultThresholdLat: number;
    static GetScale(display: IPhysicalDisplay, nav: ITileNavigationState, metrics: ITileMetrics): ICartesian3;
    private _scaleChangedOnservable?;
    private _observer;
    private _display;
    private _nav;
    private _metrics;
    private _currentCenter;
    private _thresholdLat;
    constructor(display: IPhysicalDisplay, nav: ITileNavigationState | IHasNavigationState, metrics: ITileMetrics);
    get thresholdLat(): number;
    set thresholdLat(v: number);
    get scaleChangedObservable(): Observable<ICartesian3>;
    dispose(): void;
    protected _onNavigationPropertyChanged(e: PropertyChangedEventArgs<ITileNavigationState, unknown>): void;
    protected _onZoomChanged(): void;
    protected _onCenterChanged(): void;
    protected _thresholdExceeded(a: IGeo2, b: IGeo2): boolean;
}
