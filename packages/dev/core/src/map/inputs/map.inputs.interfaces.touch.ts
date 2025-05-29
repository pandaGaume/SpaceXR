import { Observable } from "../../events";
import { ICartesian2 } from "../../geometry";

/// <summary>
/// Returns true if the current device supports touch input (multi-touch or single-touch).
/// </summary>
export function IsTouchCapable(): boolean {
    const hasTouchEvents = "ontouchstart" in window;
    const hasTouchConstructor = typeof window !== "undefined" && "DocumentTouch" in window && document instanceof (window as any).DocumentTouch;
    const hasTouchPoints = navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0;

    return hasTouchEvents || hasTouchConstructor || hasTouchPoints;
}

/// <summary>
/// Directions that can be recognized in a 2D swipe gesture.
/// </summary>
export type SwipeDirection2D = "left" | "right" | "up" | "down" | "diagonal-left-up" | "diagonal-left-down" | "diagonal-right-up" | "diagonal-right-down";

/// <summary>
/// Extended directions for a 3D swipe context, including forward and backward.
/// </summary>
export type SwipeDirection3D = SwipeDirection2D | "forward" | "backward";

/// <summary>
/// Enumeration of known touch gesture types.
/// </summary>
export enum TouchGestureType {
    Tap = 0,
    LongPress = 1,
    Rotate = 2,
    Swipe = 3,
    Pinch = 4,
    Drag = 5,
}

/// <summary>
/// Base interface for any touch gesture.
/// </summary>
export interface IGesture<C extends ICartesian2> {
    /// <summary>Type identifier (should be used for discriminating between gestures).</summary>
    type: number;

    /// <summary>Timestamp of the gesture (performance.now() or epoch in ms).</summary>
    timestamp: number;

    /// <summary>Total duration of the gesture in milliseconds.</summary>
    duration: number;

    /// <summary>Array of points involved in the gesture (e.g. fingers or touch contacts).</summary>
    points: Array<C>;
}

/// <summary>
/// A generic touch gesture using 2D cartesian coordinates.
/// </summary>
export interface ITouchGesture extends IGesture<ICartesian2> {}

/// <summary>
/// A tap gesture (brief contact with no movement).
/// </summary>
export interface ITapGesture extends ITouchGesture {
    type: TouchGestureType.Tap;
}

/// <summary>
/// A long press gesture (contact held for a minimum duration).
/// </summary>
export interface ILongPressGesture extends ITouchGesture {
    type: TouchGestureType.LongPress;
}

/// <summary>
/// A drag gesture (1-finger or 2-finger continuous movement).
/// </summary>
export interface IDragGesture extends ITouchGesture {
    type: TouchGestureType.Drag;

    /// <summary>Total movement along the X axis in pixels.</summary>
    deltaX: number;

    /// <summary>Total movement along the Y axis in pixels.</summary>
    deltaY: number;

    /// <summary>Optional starting point of the drag (center point if 2-finger drag).</summary>
    startPosition?: ICartesian2;
}

/// <summary>
/// A pinch gesture (2-finger gesture modifying scale).
/// </summary>
export interface IPinchGesture extends ITouchGesture {
    type: TouchGestureType.Pinch;

    /// <summary>Center point between fingers during the pinch.</summary>
    center: ICartesian2;

    /// <summary>Scaling factor (e.g. 1.0 = no change, >1.0 = zoom in, <1.0 = zoom out).</summary>
    scale: number;

    /// <summary>Optional starting center point.</summary>
    startPosition?: ICartesian2;
}

/// <summary>
/// A rotate gesture (2-finger rotation around a common center).
/// </summary>
export interface IRotateGesture extends ITouchGesture {
    type: TouchGestureType.Rotate;

    /// <summary>Total angle of rotation in degrees (positive = clockwise).</summary>
    angle: number;

    /// <summary>Center of the rotation gesture.</summary>
    center: ICartesian2;

    /// <summary>Optional starting center point.</summary>
    startPosition?: ICartesian2;
}

/// <summary>
/// A swipe gesture (fast directional movement).
/// </summary>
export interface ISwipeGesture extends ITouchGesture {
    type: TouchGestureType.Swipe;

    /// <summary>Direction of the swipe.</summary>
    direction: SwipeDirection2D | SwipeDirection3D;

    /// <summary>Distance covered during the swipe in pixels.</summary>
    distance: number;
}

/// <summary>
/// Mapping between gesture type names and their corresponding structure.
/// Extend this map via module augmentation if you introduce custom gestures.
/// </summary>
export interface TouchGestureTypeMap {
    tap: ITapGesture;
    longPress: ILongPressGesture;
    rotate: IRotateGesture;
    swipe: ISwipeGesture;
    pinch: IPinchGesture;
    drag: IDragGesture;
}

/// <summary>
/// Discriminated union of all touch gesture types.
/// </summary>
export type AnyTouchGesture = TouchGestureTypeMap[keyof TouchGestureTypeMap];

/// <summary>
/// Interface representing a source that can emit touch gestures.
/// </summary>
export interface ITouchGestureSource {
    /// <summary>Observable used to notify subscribers of any detected gesture.</summary>
    onTouchObservable: Observable<AnyTouchGesture>;
}
