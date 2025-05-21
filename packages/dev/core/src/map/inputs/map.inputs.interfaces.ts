import { Observable } from "../../events";
import { ICartesian2 } from "../../geometry";
import { ITouchGestureSource } from "./map.inputs.interfaces.touch";

/// <summary>
/// Interface for a source that can emit pointer events, such display.
/// This is usually used as a proxy for the Pointer events gathered througt the IPointerTarget.
/// Despite the name we have DOM -> PointerTarget -> Controller -> PointerSource -> MapApi
/// </summary>
/// <typeparam name="T">Type of the source object.</typeparam>
export interface IPointerSource {
    onPointerOverObservable: Observable<PointerEvent>;
    onPointerEnterObservable: Observable<PointerEvent>;
    onPointerOutObservable: Observable<PointerEvent>;
    onPointerLeaveObservable: Observable<PointerEvent>;
    onPointerMoveObservable: Observable<PointerEvent>;
    onPointerDownObservable: Observable<PointerEvent>;
    onPointerUpObservable: Observable<PointerEvent>;
    onPointerCancelObservable: Observable<PointerEvent>;
    onPointerGotCaptureObservable: Observable<PointerEvent>;
    onPointerLostCaptureObservable: Observable<PointerEvent>;
}

export interface IWheelSource {
    onWheelObservable: Observable<WheelEvent>;
}

export interface IDragSource {
    onDragObservable: Observable<IPointerDragEvent>;
}

export type DragEventType = "start" | "drag" | "end";

/// <summary>
/// Represents a semantic pointer drag event derived from low-level PointerEvents.
/// Unlike the native DOM DragEvent ("dragstart", "drop"), this event is compatible
/// with canvas, 3D scenes, multi-touch, and WebXR. It does not require setting
/// draggable=true and works across all pointer types.
/// </summary>
export interface IPointerDragEvent extends ICartesian2 {
    type: DragEventType;
    pointerId: number;
    button: number;
    startX: number;
    startY: number;
    deltaX: number;
    deltaY: number;
    timestamp: number;
    originalEvent: PointerEvent;
}

export interface IInputSource extends IPointerSource, IWheelSource, IDragSource, ITouchGestureSource {}
