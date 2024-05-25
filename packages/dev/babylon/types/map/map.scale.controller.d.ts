import { IHasNavigationState, ITileMetrics, ITileNavigationState } from "core/tiles";
import { VirtualDisplay } from "../display";
import { ICartesian3 } from "core/geometry";
import { Observable, PropertyChangedEventArgs } from "core/events";
import { IDisposable } from "core/types";
export declare function hasMapScale(obj: unknown): obj is IHasMapScale;
export interface IHasMapScale {
    mapScale: ICartesian3;
}
export declare class Map3dScaleController implements IDisposable {
    static GetScale(display: VirtualDisplay, nav: ITileNavigationState, metrics: ITileMetrics): ICartesian3;
    private _scaleChangedOnservable?;
    private _observer;
    private _display;
    private _nav;
    private _metrics;
    constructor(display: VirtualDisplay, nav: ITileNavigationState | IHasNavigationState, metrics: ITileMetrics);
    get scaleChangedObservable(): Observable<ICartesian3>;
    dispose(): void;
    protected _onNavigationPropertyChanged(e: PropertyChangedEventArgs<ITileNavigationState, unknown>): void;
    protected _onZoomChanged(): void;
    protected _onCenterChanged(): void;
}
