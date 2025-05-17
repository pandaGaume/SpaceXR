import * as BABYLON from "@babylonjs/core";
import { VirtualDisplay } from "./display.virtual";
import { IDragSource, IInputSource, IPointerDragEvent, PointerToDragController } from "core/map/inputs";
import { Observable } from "core/events";
import { IDisposable } from "core/types";
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
    _dragController: IDragSource;
    _display: VirtualDisplay;
    _prePointerObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.PointerInfoPre>>;
    _currentPosition: BABYLON.Nullable<BABYLON.Vector2>;
    constructor(display: VirtualDisplay);
    get display(): VirtualDisplay;
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
    private _onPointerDown;
    private _onPointerUp;
    private _onPointerMove;
    private _onWheel;
    protected _getPickingInfos(scene: BABYLON.Scene): BABYLON.Nullable<BABYLON.PickingInfo>;
    protected _pickFilter(mesh: BABYLON.Nullable<any>): boolean;
    protected _getScene(): BABYLON.Scene;
}
