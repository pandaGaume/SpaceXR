import { Observable } from "../../events";
import { ICartesian2 } from "../../geometry";
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
export interface IInputSource extends IPointerSource, IWheelSource, IDragSource {
}
