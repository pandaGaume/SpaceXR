import * as BABYLON from "@babylonjs/core";
import { VirtualDisplay } from "./display.virtual";
import { AnyTouchGesture, IDragSource, IInputSource, IPointerDragEvent, ITouchGestureSource, PointerToDragController } from "core/map/inputs";
import { Observable } from "core/events";
import { IDisposable } from "core/types";
import { PointerToGestureController } from "core/map/inputs/map.inputs.controller.touch";
export interface ITransformedPointerEvent extends PointerEvent {
    displayX: number;
    displayY: number;
    userCoordinates?: BABYLON.Nullable<BABYLON.Vector2>;
}
export declare class TransformedPointerToDragController extends PointerToDragController {
    constructor(source: IInputSource);
    protected _getClientX(e: PointerEvent): number;
    protected _getClientY(e: PointerEvent): number;
}
export declare class TransformedPointerToGestureController extends PointerToGestureController {
    constructor(source: IInputSource);
    protected _getClientX(e: PointerEvent): number;
    protected _getClientY(e: PointerEvent): number;
}
export declare class VirtualDisplayInputsSource implements IInputSource, IDisposable {
    _onPointerOverObservable?: Observable<PointerEvent>;
    _onPointerEnterObservable?: Observable<PointerEvent>;
    _onPointerOutObservable?: Observable<PointerEvent>;
    _onPointerLeaveObservable?: Observable<PointerEvent>;
    _onPointerMoveObservable?: Observable<PointerEvent>;
    _onPointerDownObservable?: Observable<PointerEvent>;
    _onPointerUpObservable?: Observable<PointerEvent>;
    _onPointerCancelObservable?: Observable<PointerEvent>;
    _onPointerGotCaptureObservable?: Observable<PointerEvent>;
    _onPointerLostCaptureObservable?: Observable<PointerEvent>;
    _onWheelObservable?: Observable<WheelEvent>;
    _meshUnderPointer?: BABYLON.Nullable<BABYLON.AbstractMesh>;
    _dragController: IDragSource;
    _touchController?: ITouchGestureSource;
    _display: VirtualDisplay;
    _prePointerObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.PointerInfoPre>>;
    _lastX: number;
    _lastY: number;
    _cache: BABYLON.Vector2;
    constructor(display: VirtualDisplay);
    get display(): VirtualDisplay;
    get onTouchObservable(): Observable<AnyTouchGesture>;
    get onDragObservable(): Observable<IPointerDragEvent>;
    get onPointerOverObservable(): Observable<PointerEvent>;
    get onPointerEnterObservable(): Observable<PointerEvent>;
    get onPointerOutObservable(): Observable<PointerEvent>;
    get onPointerLeaveObservable(): Observable<PointerEvent>;
    get onPointerMoveObservable(): Observable<PointerEvent>;
    get onPointerDownObservable(): Observable<PointerEvent>;
    get onPointerUpObservable(): Observable<PointerEvent>;
    get onPointerCancelObservable(): Observable<PointerEvent>;
    get onPointerGotCaptureObservable(): Observable<PointerEvent>;
    get onPointerLostCaptureObservable(): Observable<PointerEvent>;
    get onWheelObservable(): Observable<WheelEvent>;
    dispose(): void;
    protected _attach(): void;
    protected _onPrePointer(pi: BABYLON.PointerInfoPre): void;
    private _getBasePointer;
    private _onPointerDown;
    private _onPointerUp;
    private _onPointerMove;
    private _onWheel;
    protected _getPickingInfos(scene: BABYLON.Scene): BABYLON.Nullable<BABYLON.PickingInfo>;
    protected _pickFilter(mesh: BABYLON.Nullable<any>): boolean;
    protected _getScene(): BABYLON.Scene;
}
