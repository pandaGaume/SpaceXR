import { Observable } from "../../events";
import { ICartesian2 } from "../../geometry";

export interface IWheelTarget<T> {
    onWheel(src: T, d: number): void;
}

/// <summary>
/// Interface for a target that can receive pointer events from the DOM.
/// </summary>
/// <typeparam name="T">Type of the source object.</typeparam>
export interface IPointerTarget<T> {
    onPointerOver(src: T, x: number, y: number, id?: number): void;
    onPointerEnter(src: T, x: number, y: number, id?: number): void;
    onPointerOut(src: T, x: number, y: number, id?: number): void;
    onPointerLeave(src: T, x: number, y: number, id?: number): void;
    onPointerDown(src: T, x: number, y: number, buttonIndex: number, id?: number): void;
    onPointerUp(src: T, x: number, y: number, buttonIndex: number, id?: number): void;
    onPointerMove(src: T, x: number, y: number, id?: number): void;
    onPointerCancel(src: T, x: number, y: number, id?: number): void;
    onPointerGotCapture(src: T, x: number, y: number, id?: number): void;
    onPointerLostCapture(src: T, x: number, y: number, id?: number): void;
}

export interface IDragTarget<T> {
    onBeginDrag(src: T, dx: number, dy: number, buttonIndex: number, id?: number): void;
    onDrag(src: T, dx: number, dy: number, buttonIndex: number, id?: number): void;
    onEndDrag(src: T, dx: number, dy: number, buttonIndex: number, id?: number): void;
}

export interface ICartesian2WithInfos extends ICartesian2 {
    buttonIndex?: number;
    pointerId?: number;
}

/// <summary>
/// Interface for a source that can emit pointer events, such display.
/// This is usually used as a proxy for the Pointer events gathered througt the IPointerTarget.
/// Despite the name we have DOM -> PointerTarget -> Controller -> PointerSource -> MapApi
/// </summary>
/// <typeparam name="T">Type of the source object.</typeparam>
export interface IPointerSource {
    onPointerOverObservable: Observable<ICartesian2WithInfos>;
    onPointerEnterObservable: Observable<ICartesian2WithInfos>;
    onPointerOutObservable: Observable<ICartesian2WithInfos>;
    onPointerLeaveObservable: Observable<ICartesian2WithInfos>;
    onPointerMoveObservable: Observable<ICartesian2WithInfos>;
    onPointerDownObservable: Observable<ICartesian2WithInfos>;
    onPointerUpObservable: Observable<ICartesian2WithInfos>;
    onPointerCancelObservable: Observable<ICartesian2WithInfos>;
    onPointerGotCaptureObservable: Observable<ICartesian2WithInfos>;
    onPointerLostCaptureObservable: Observable<ICartesian2WithInfos>;
}

export interface IWheelSource {
    onWheelObservable: Observable<number>;
}

export interface IDragSource {
    onBeginDragObservable: Observable<ICartesian2WithInfos>;
    onDragObservable: Observable<ICartesian2WithInfos>;
    onEndDragObservable: Observable<ICartesian2WithInfos>;
}
