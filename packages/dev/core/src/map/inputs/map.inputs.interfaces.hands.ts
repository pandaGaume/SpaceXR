import { Observable } from "../../events";
import { ICartesian3 } from "../../geometry"; // 3D point
import { IGesture, SwipeDirection3D } from "./map.inputs.interfaces.touch";

export interface IXRHandTarget {
    /// <summary>
    /// Called when the hand is first detected.
    /// </summary>
    onXRHandStart(inputSource: XRInputSource, frame: XRFrame): void;

    /// <summary>
    /// Called every frame with updated joint data from the XRHand.
    /// </summary>
    onXRHandUpdate(inputSource: XRInputSource, frame: XRFrame): void;

    /// <summary>
    /// Called when the hand is no longer tracked.
    /// </summary>
    onXRHandEnd(inputSource: XRInputSource, frame: XRFrame): void;
}

export enum XRGestureType {
    Grab = "grab",
    Release = "release",
    Pinch = "pinch",
    Point = "point",
    Swipe = "swipe",
    Custom = "custom",
}

export type XRHandType = "left" | "right";
export type XRHandJoint = "thumb" | "index" | "middle" | "ring" | "pinky" | "wrist" | "elbow" | "shoulder";

/**
 * Base XR gesture interface.
 */
export interface IXRGesture extends IGesture<ICartesian3> {
    hand: XRHandType;
}

/**
 * Swipe gesture with a direction and distance.
 */
export interface IXRSwipeGesture extends IXRGesture {
    type: XRGestureType.Swipe;
    direction: SwipeDirection3D;
    distance: number; // in meters or normalized units
}

/**
 * Pinch gesture with scale and center point.
 */
export interface IXRPinchGesture extends IXRGesture {
    type: XRGestureType.Pinch;
    center: ICartesian3;
    scale: number; // e.g., 1.0 = no scale, <1 = pinch in, >1 = pinch out
}

/**
 * Grab gesture
 */
export interface IXRGrabGesture extends IXRGesture {
    type: XRGestureType.Grab;
}

/**
 * Release gesture
 */
export interface IXRReleaseGesture extends IXRGesture {
    type: XRGestureType.Release;
}

/**
 * Point gesture
 */
export interface IXRPointGesture extends IXRGesture {
    type: XRGestureType.Point;
    direction: ICartesian3; // forward direction of pointing finger
}

/// <summary>
/// Represents the mapping of known XR gesture types to their corresponding structures.
/// This map enables discriminated unions and safe extension.
/// </summary>
export interface XRGestureTypeMap {
    grab: IXRGrabGesture;
    release: IXRReleaseGesture;
    pinch: IXRPinchGesture;
    point: IXRPointGesture;
    swipe: IXRSwipeGesture;
    // Users may augment this map
}

export type AnyXRGesture = XRGestureTypeMap[keyof XRGestureTypeMap];

/**
 * Observable source for XR gestures.
 */
export interface IXRGestureSource {
    onXRGestureObservable: Observable<AnyXRGesture>;
}
