import { Observable } from "../../events";
import { ICartesian2 } from "../../geometry";

/// <summary>
/// Returns true if the current device supports touch input.
/// </summary>
export function IsTouchCapable(): boolean {
    const hasTouchEvents = "ontouchstart" in window;
    const hasTouchConstructor = typeof window !== "undefined" && "DocumentTouch" in window && document instanceof (window as any).DocumentTouch;
    const hasTouchPoints = navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0;

    return hasTouchEvents || hasTouchConstructor || hasTouchPoints;
}

export type SwipeDirection = "left" | "right" | "up" | "down";

export type SwipeDirection2D = "left" | "right" | "up" | "down" | "diagonal-left-up" | "diagonal-left-down" | "diagonal-right-up" | "diagonal-right-down";

export type SwipeDirection3D = "left" | "right" | "up" | "down" | "diagonal-left-up" | "diagonal-left-down" | "diagonal-right-up" | "diagonal-right-down" | "forward" | "backward";

export enum TouchGestureType {
    Tap = "tap",
    Swipe = "swipe",
    Pinch = "pinch",
}

export interface IGesture<C extends ICartesian2> {
    type: string;
    timestamp: number; // milliseconds since epoch or performance.now()
    duration: number; // in milliseconds
    points: Array<C>; // positions of the points involved
}

export interface ITouchGesture extends IGesture<ICartesian2> {}

export interface ISwipeGesture extends ITouchGesture {
    type: TouchGestureType.Swipe;
    direction: SwipeDirection | SwipeDirection2D | SwipeDirection3D;
    distance: number; // in pixels
}

export interface IPinchGesture extends ITouchGesture {
    type: TouchGestureType.Pinch;
    center: ICartesian2;
    scale: number;
}

export interface ITapGesture extends ITouchGesture {
    type: TouchGestureType.Tap;
}

/// <summary>
/// Represents the mapping of known touch gesture types to their corresponding structures.
///
/// This map is used to build a discriminated union (`AnyTouchGesture`) that covers all supported gestures.
/// Users can safely extend this map using TypeScript module augmentation without modifying the original source.
///
/// Example:
/// ```ts
/// // Extend with a custom gesture type
/// declare module "./touch-gestures" {
///     interface TouchGestureTypeMap {
///         rotate: IRotateGesture;
///     }
/// }
///
/// export interface IRotateGesture extends ITouchGestureBase {
///     type: "rotate";
///     angle: number;
/// }
/// ```
///
/// Once augmented, your custom gesture will be recognized as part of `AnyTouchGesture`,
/// enabling safe type narrowing and inference in gesture handlers.
/// </summary>
export interface TouchGestureTypeMap {
    tap: ITapGesture;
    swipe: ISwipeGesture;
    pinch: IPinchGesture;
    // users can augment this
}

export type AnyTouchGesture = TouchGestureTypeMap[keyof TouchGestureTypeMap];

export interface ITouchGestureSource {
    onTouchObservable: Observable<AnyTouchGesture>;
}
