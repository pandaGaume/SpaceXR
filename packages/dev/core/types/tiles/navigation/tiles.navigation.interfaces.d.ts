import { IGeo2, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileSystemBounds } from "../tiles.interfaces";
import { ICloneable, IDisposable, IValidable, Nullable } from "../../types";
import { ICartesian3, IPlane, IQuaternion } from "../../geometry";
export interface IHasNavigationState {
    navigationState: Nullable<ITileNavigationState>;
}
export declare function HasNavigationState(obj: unknown): obj is IHasNavigationState;
/**
 * Options required to turn an ICameraState into a perspective frustum.
 */
export interface IFrustumValues {
    /** Viewport aspect ratio (width/height). Default: 16/9. */
    aspect?: number;
    /** Near plane distance (> 0). Default: 0.1. */
    near?: number;
    /** Far plane distance (> near). Default: 10_000. */
    far?: number;
    /** World up vector. Default: {0,1,0}. */
    up?: ICartesian3;
}
export interface ICameraViewState extends IFrustumValues {
    propertyChangedObservable?: Observable<PropertyChangedEventArgs<ICameraViewState, unknown>>;
    worldPosition: ICartesian3;
    worldRotation: IQuaternion;
    fovY: number;
    tanFov2: number;
    frustumPlanes?: Array<IPlane>;
}
export type CameraStateListener = (state: ICameraViewState) => void;
export interface ITileNavigationState extends IValidable, ICloneable<ITileNavigationState>, IDisposable {
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;
    center: IGeo2;
    zoom: number;
    azimuth: Bearing;
    bounds: ITileSystemBounds;
    lod: number;
    scale: number;
    copy(state: ITileNavigationState): ITileNavigationState;
    syncWith(state: Nullable<ITileNavigationState>): ITileNavigationState;
    mapscale?: number;
}
export declare function IsTileNavigationState(b: unknown): b is ITileNavigationState;
export interface ITileNavigationApi extends IHasNavigationState, IDisposable {
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number, validate?: boolean): ITileNavigationApi;
    zoomMap(delta: number, validate?: boolean): ITileNavigationApi;
    zoomInMap(delta: number, validate?: boolean): ITileNavigationApi;
    zoomOutMap(delta: number, validate?: boolean): ITileNavigationApi;
    translateUnitsMap(tx: number, ty: number, validate?: boolean): ITileNavigationApi;
    translateMap(dlat: IGeo2 | Array<number> | number, dlon?: number, validate?: boolean): ITileNavigationApi;
    rotateMap(r: number, validate?: boolean): ITileNavigationApi;
}
export declare function IsTileNavigationApi(b: unknown): b is ITileNavigationApi;
export interface IHasNavigationApi {
    navigationApi: Nullable<ITileNavigationApi>;
}
export declare function HasNavigationApi<T>(obj: unknown): obj is IHasNavigationApi;
