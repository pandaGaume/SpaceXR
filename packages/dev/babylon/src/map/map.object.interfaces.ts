import { IBoundingBox, IBoundingSphere, IPlane, ISize2 } from "core/geometry";
import { ICameraState, ISourceBlock, ITileAddress2 } from "core/tiles";

// Module augmentation for Babylon.js
declare module "@babylonjs/core/Meshes/abstractMesh" {
    interface AbstractMesh extends IMap3dObjectNode {}
}

/**
 * Enumeration for the refinement strategy used when traversing the object hierarchy for rendering.
 * - `add`: Children are added to the current set of rendered objects (additive refinement).
 * - `replace`: Children replace the current object (replacement refinement).
 * - `unknown`: The refinement strategy is not specified or is implementation dependent.
 */
export enum Map3dObjectRefineType {
    add,
    replace,
    unknown = 999,
}

/**
 * Function signature for computing the screen space error (SSE) of a tile or object.
 *
 * @param tileGeometricError - The geometric error of the tile/object (in meters).
 * @param distanceToCamera - The distance from the tile/object to the camera (in meters).
 * @param viewportHeight - The height of the viewport (in pixels).
 * @param tanfov2 - The tangent of half the field of view (unitless).
 * @returns The screen space error, typically measured in pixels.
 */
export type ScreenSpaceErrorFn = (tileGeometricError: number, distanceToCamera: number, viewportHeight: number, tanfov2: number) => number;

/**
 * used to test if the object is within camera view boundaries.
 */
interface ICullable {
    isCompletelyInFrustum(frustumPlanes: IPlane[]): boolean;
    isInFrustum(frustumPlanes: IPlane[]): boolean;
}

/**
 * Describes the bounding information for a 3D object (structure similar to Babylon.js BoundingInfo).
 */
export interface IBoundingInfo extends ICullable {
    /**
     * The axis-aligned bounding box of the object.
     */
    boundingBox: IBoundingBox;

    /**
     * The bounding sphere of the object.
     */
    boundingSphere: IBoundingSphere;
}

export interface IMap3dObjectNodeRef<T> {
    /**
     * return the bounding infos.
     */
    getBoundingInfo?(): IBoundingInfo;
    /**
     * A uri that points to object content.
     */
    address: T;
}

export type Map3dObjectNodeRefType = ITileAddress2 | string;

/**
 * Interface describing a 3D map object that can be refined and evaluated for level of detail.
 * This interface is designed to handle the streaming process only. Other aspects, such as transformations, are managed by the underlying 3D framework.
 */
export interface IMap3dObjectNode extends IMap3dObjectNodeRef<Map3dObjectNodeRefType> {
    /**
     * The geometric error, in meters, introduced if this object is rendered and its children are not.
     * At runtime, the geometric error is used to compute screen space error (SSE), i.e., the error measured in pixels.
     */
    geometricError?: number;

    /**
     * Specifies if additive or replacement refinement is used when traversing the hierarchy for rendering.
     * Default value is implementation dependent.
     */
    refine?: Map3dObjectRefineType;

    /**
     * The broader or original link this node is refined from.
     */
    refinedFrom?: IMap3dObjectNodeRef<Map3dObjectNodeRefType>;

    /**
     * The more specific or refined links derived from this node.
     */
    refinements?: Array<IMap3dObjectNodeRef<Map3dObjectNodeRefType>>;

    /**
     * Optional function to compute the screen space error (SSE) for this object.
     */
    screenSpaceError?: ScreenSpaceErrorFn;
}

/**
 * Computes the screen space error (SSE) for an object based on its geometric error,
 * the distance to the camera, the viewport height, and the tangent of half the field of view.
 *
 * @param tileGeometricError - The geometric error of the object (in meters).
 * @param distanceToCamera - The distance from the object to the camera (in meters).
 * @param viewportHeight - The height of the viewport (in pixels).
 * @param tanfov2 - The tangent of half the field of view (unitless).
 * @returns The screen space error, typically in pixels.
 */
export const ScreenSpaceError: ScreenSpaceErrorFn = (tileGeometricError, distanceToCamera, viewportHeight, tanfov2) =>
    (tileGeometricError * viewportHeight) / (distanceToCamera * tanfov2);

/**
 * Configuration options for the camera-based tile fetch engine.
 */
export interface ICameraFetchEngineOptions {
    /**
     * The maximum allowed screen-space error (SSE), in pixels,
     * before a object should be refined (loaded at higher LOD).
     * Typical values: 8–24 depending on visual quality requirements.
     */
    maxScreenSpaceError: number;

    /**
     * Optional fixed hysteresis offset, in pixels, applied when coarsening LOD.
     * This avoids constant refine/coarsen flicker when SSE is near the threshold.
     *
     * Example:
     *   If `maxScreenSpaceError = 16` and `hysteresisOffset = 2`,
     *   coarsening will only happen when SSE drops below 14.
     *
     * Precedence:
     *   If both `hysteresisOffset` and `hysteresisPercent` are provided,
     *   this fixed offset takes precedence over the percentage value.
     */
    hysteresisOffset?: number;

    /**
     * Optional hysteresis as a percentage of `maxScreenSpaceError`.
     * This is only applied if `hysteresisOffset` is not defined.
     *
     * Example:
     *   If `maxScreenSpaceError = 16` and `hysteresisPercent = 0.1` (10%),
     *   coarsening will only happen when SSE drops below 14.4.
     */
    hysteresisPercent?: number;
}

/**
 * Engine interface for fetching resources based on camera state changes.
 * Inherits from ISourceBlock to provide a stream of resource addresses to download (e.g., tiles).
 */
export interface ICameraFetchEngine extends ISourceBlock<IMap3dObjectNodeRef<Map3dObjectNodeRefType>> {
    /**
     * Notifies the engine of a change in camera state.
     * The engine should process the new camera state and, as a result, emit the list of resource addresses
     * to be fetched via the source block. This method is synchronous and does not wait for background
     * processing to complete.
     *
     * @param state - The new camera state, including position, target, and field of view.
     * @param displaySize - the projection plan size in pixel.
     */
    onCameraStateChange(state: ICameraState, displaySize: ISize2): void;
}
