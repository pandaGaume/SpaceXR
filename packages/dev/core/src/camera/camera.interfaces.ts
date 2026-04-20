import { IBounds, ICartesian3, IPlane, IQuaternion } from "../geometry";
import { PropertyChangedEventArgs, Observable } from "../events";

/**
 * Options required to turn an ICameraViewState into a perspective frustum.
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
    /// <summary>
    /// An observable that notifies subscribers of changes to properties in the camera state.
    /// </summary>
    propertyChangedObservable?: Observable<PropertyChangedEventArgs<ICameraViewState, unknown>>;

    worldPosition: ICartesian3; // position in world space
    worldRotation: IQuaternion; // orientation in world space
    fovY: number; // perspective FOV in radians (0 if ortho)
    tanFov2: number; // Math.tan(fovY / 2)
    frustumPlanes?: Array<IPlane>; // frustum plane. Should be lazzy initialisation.
    /**
     * Viewport height in pixels. Required by screen-space error computations.
     * Optional for legacy callers that only need the pose + optics.
     */
    viewportHeight?: number;

    /**
     * Optional frustum-intersection test. When provided, consumers (e.g. the SSE
     * visibility policy) should prefer it over computing plane tests from
     * `frustumPlanes`. Host engines (Babylon.js and similar) already ship a
     * well-optimized implementation which we piggyback on when available.
     */
    isInFrustum?(bounds: IBounds): boolean;
}

export type CameraStateListener = (state: ICameraViewState) => void;
