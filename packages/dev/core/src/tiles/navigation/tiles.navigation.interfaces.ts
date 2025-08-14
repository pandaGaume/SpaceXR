import { IGeo2, IsLocation, Bearing } from "../../geography";
import { PropertyChangedEventArgs, Observable } from "../../events";
import { ITileSystemBounds, IsTileSystemBounds } from "../tiles.interfaces";
import { ICloneable, IDisposable, IValidable, Nullable } from "../../types";
import { ICartesian3, IPlane } from "../../geometry";

export interface IHasNavigationState {
    navigationState: Nullable<ITileNavigationState>;
}

export function HasNavigationState(obj: unknown): obj is IHasNavigationState {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasNavigationState>obj).navigationState !== undefined;
}

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
/// <summary>
/// Represents the camera view (pose + optics) used to derive frustum and SSE.
/// Distances are expressed in local scene units; geometric errors are in meters.
/// The renderer uses `metersToLocalScale` to compare them coherently.
/// </summary>
export interface ICameraViewState extends IFrustumValues {
    /// <summary>Notifies when any property changes (pose, optics, frustum inputs).</summary>
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ICameraViewState, unknown>>;

    /// <summary>Camera position in local scene coordinates.</summary>
    position: ICartesian3;

    /// <summary>Point the camera looks at (local scene coordinates).</summary>
    target: ICartesian3;

    /// <summary>Vertical field of view in radians.</summary>
    fovY: number;

    /// <summary>tan(fovY/2) precomputed for SSE; keep in sync with fovY.</summary>
    tanfov2: number;

    /// <summary>Compute frustum planes for culling in current view.</summary>
    getFrustumPlanes(options?: IFrustumValues): Array<IPlane>;
}

/// <summary>
/// Represents the navigation state of a tile-based system, encompassing essential properties
/// for managing the display, navigation, and level of detail (LOD) of tiles. This interface
/// is crucial for synchronizing navigation states across systems and managing updates to the
/// tile system.
/// </summary>
export interface ITileNavigationState extends IValidable, ICloneable<ITileNavigationState>, IDisposable {
    /// <summary>
    /// An observable that notifies subscribers of changes to properties in the navigation state.
    /// This enables reactive updates when properties like `zoom`, `azimuth`, or `bounds` are modified.
    /// </summary>
    propertyChangedObservable: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;

    /// <summary>
    /// The geographic center of the current view, defined as latitude and longitude coordinates.
    /// This property determines the focus point of the tile system in geographic space.
    /// </summary>
    center: IGeo2;

    /// <summary>
    /// The zoom level of the current view. A higher zoom level corresponds to a closer, more
    /// detailed view, while a lower zoom level provides a broader overview.
    /// </summary>
    zoom: number;

    /// <summary>
    /// The azimuth (or bearing) angle of the current view, which defines the orientation of the map.
    /// This is typically measured in degrees clockwise from true north.
    /// </summary>
    azimuth: Bearing;

    /// <summary>
    /// The bounds of the current tile system view, defined in terms of the coordinate system used
    /// by the tile system. This property specifies the visible area and is used to determine which
    /// tiles need to be rendered or loaded.
    /// </summary>
    bounds: ITileSystemBounds;

    /// <summary>
    /// The Level of Detail (LOD) for the tiles, computed as the integer part of the `zoom` property.
    /// This determines the resolution of tiles to be rendered. Higher LOD corresponds to finer details.
    /// </summary>
    lod: number;

    /// <summary>
    /// The scale factor corresponding to the decimal part of the `zoom` property. This allows for
    /// smooth transitions between zoom levels and finer control over tile rendering.
    /// </summary>
    scale: number;

    /// <summary>
    /// Optional property representing the camera state. When provided, it includes parameters like
    /// position, target, and field of view (FOV), which are critical for calculating the Level of
    /// Detail (LOD) dynamically based on the camera's perspective and proximity to tiles.
    /// </summary>
    camera?: ICameraViewState;

    /// <summary>
    /// Copies the properties from the provided state into the current state. This is used for
    /// duplicating or updating navigation states while preserving references.
    /// </summary>
    copy(state: ITileNavigationState): ITileNavigationState;

    /// <summary>
    /// Synchronizes the current state with the given state. If the provided state is `null` or `undefined`,
    /// this method resets the current state to its default values. This ensures consistency across multiple
    /// navigation state instances.
    /// </summary>
    syncWith(state: Nullable<ITileNavigationState>): ITileNavigationState;

    /// <summary>
    /// Scale factor that converts real-world meters to local scene units.
    /// Example: if 1 m (real) equals 0.01 units (tabletop hologram), set 0.01.
    /// Default = 1.0 (ECEF/ENU scenes at real scale).
    /// Used in SSE/LOD to compare geometric error (meters) with camera distance (local units).
    /// <summary>

    metersToLocalScale?: number;

    /// <summary>
    /// Monotonically increasing token incremented whenever any field changes
    // (center/zoom/azimuth/bounds/camera/metersToLocalScale).
    /// <summary>
    version?: number;
}

export function IsTileNavigationState(b: unknown): b is ITileNavigationState {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileNavigationState>b).center !== undefined &&
        IsLocation((<ITileNavigationState>b).center) &&
        (<ITileNavigationState>b).zoom !== undefined &&
        (<ITileNavigationState>b).azimuth !== undefined &&
        (<ITileNavigationState>b).azimuth instanceof Bearing &&
        (<ITileNavigationState>b).bounds !== undefined &&
        IsTileSystemBounds((<ITileNavigationState>b).bounds)
    );
}

export interface ITileNavigationApi extends IHasNavigationState, IDisposable {
    setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number, validate?: boolean): ITileNavigationApi;
    zoomMap(delta: number, validate?: boolean): ITileNavigationApi;
    zoomInMap(delta: number, validate?: boolean): ITileNavigationApi;
    zoomOutMap(delta: number, validate?: boolean): ITileNavigationApi;
    translateUnitsMap(tx: number, ty: number, validate?: boolean): ITileNavigationApi;
    translateMap(dlat: IGeo2 | Array<number> | number, dlon?: number, validate?: boolean): ITileNavigationApi;
    rotateMap(r: number, validate?: boolean): ITileNavigationApi;
}

export function IsTileNavigationApi(b: unknown): b is ITileNavigationApi {
    if (b === null || typeof b !== "object") return false;
    return (
        (<ITileNavigationApi>b).setViewMap !== undefined &&
        (<ITileNavigationApi>b).zoomInMap !== undefined &&
        (<ITileNavigationApi>b).zoomOutMap !== undefined &&
        (<ITileNavigationApi>b).translateUnitsMap !== undefined &&
        (<ITileNavigationApi>b).translateMap !== undefined &&
        (<ITileNavigationApi>b).rotateMap !== undefined
    );
}

export interface IHasNavigationApi {
    navigationApi: Nullable<ITileNavigationApi>;
}

export function HasNavigationApi<T>(obj: unknown): obj is IHasNavigationApi {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasNavigationApi>obj).navigationApi !== undefined;
}
