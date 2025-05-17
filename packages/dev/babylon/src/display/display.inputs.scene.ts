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

export class TransformedPointerToDragController extends PointerToDragController {
    public constructor(source: IInputSource) {
        super(source);
    }

    protected _getClientX(e: PointerEvent): number {
        return (<ITransformedPointerEvent>e).displayX ?? e.clientX;
    }

    protected _getClientY(e: PointerEvent): number {
        return (<ITransformedPointerEvent>e).displayY ?? e.clientY;
    }
}

function GetPointerType(pointerInfo: BABYLON.PointerInfoBase): "mouse" | "touch" | "unknown" {
    const event = pointerInfo.event;

    if (typeof PointerEvent !== "undefined") {
        if (event instanceof PointerEvent) {
            return event.pointerType as "mouse" | "touch";
        } else if (event instanceof WheelEvent) {
            return "mouse";
        }
    }
    return "unknown";
}

export class VirtualDisplayInputsSource implements IInputSource, IDisposable {
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

    public constructor(display: VirtualDisplay) {
        this._display = display;
        this._prePointerObserver = null;
        this._currentPosition = null;
        this._attach();
        this._dragController = new TransformedPointerToDragController(this);
    }

    public get display(): VirtualDisplay {
        return this._display;
    }

    public get onDragObservable(): Observable<IPointerDragEvent> {
        return this._dragController.onDragObservable;
    }

    public get onPointerOverObservable(): Observable<PointerEvent> {
        if (!this._onPointerOverObservable) {
            this._onPointerOverObservable = new Observable<PointerEvent>();
        }
        return this._onPointerOverObservable;
    }

    public get onPointerEnterObservable(): Observable<PointerEvent> {
        if (!this._onPointerEnterObservable) {
            this._onPointerEnterObservable = new Observable<PointerEvent>();
        }
        return this._onPointerEnterObservable;
    }

    public get onPointerOutObservable(): Observable<PointerEvent> {
        if (!this._onPointerOutObservable) {
            this._onPointerOutObservable = new Observable<PointerEvent>();
        }
        return this._onPointerOutObservable;
    }

    public get onPointerLeaveObservable(): Observable<PointerEvent> {
        if (!this._onPointerLeaveObservable) {
            this._onPointerLeaveObservable = new Observable<PointerEvent>();
        }
        return this._onPointerLeaveObservable;
    }

    public get onPointerMoveObservable(): Observable<PointerEvent> {
        if (!this._onPointerMoveObservable) {
            this._onPointerMoveObservable = new Observable<PointerEvent>();
        }
        return this._onPointerMoveObservable;
    }

    public get onPointerDownObservable(): Observable<PointerEvent> {
        if (!this._onPointerDownObservable) {
            this._onPointerDownObservable = new Observable<PointerEvent>();
        }
        return this._onPointerDownObservable;
    }

    public get onPointerUpObservable(): Observable<PointerEvent> {
        if (!this._onPointerUpObservable) {
            this._onPointerUpObservable = new Observable<PointerEvent>();
        }
        return this._onPointerUpObservable;
    }

    public get onPointerCancelObservable(): Observable<PointerEvent> {
        if (!this._onPointerCancelObservable) {
            this._onPointerCancelObservable = new Observable<PointerEvent>();
        }
        return this._onPointerCancelObservable;
    }

    public get onPointerGotCaptureObservable(): Observable<PointerEvent> {
        if (!this._onPointerGotCaptureObservable) {
            this._onPointerGotCaptureObservable = new Observable<PointerEvent>();
        }
        return this._onPointerGotCaptureObservable;
    }

    public get onPointerLostCaptureObservable(): Observable<PointerEvent> {
        if (!this._onPointerLostCaptureObservable) {
            this._onPointerLostCaptureObservable = new Observable<PointerEvent>();
        }
        return this._onPointerLostCaptureObservable;
    }

    public get onWheelObservable(): Observable<WheelEvent> {
        if (!this._onWheelObservable) {
            this._onWheelObservable = new Observable<WheelEvent>();
        }
        return this._onWheelObservable;
    }

    public dispose(): void {
        const scene = this._getScene();
        if (scene) {
            if (this._prePointerObserver) {
                scene.onPrePointerObservable.remove(this._prePointerObserver);
            }
        }
        this._onPointerOverObservable?.clear();
        this._onPointerEnterObservable?.clear();
        this._onPointerOutObservable?.clear();
        this._onPointerLeaveObservable?.clear();
        this._onPointerMoveObservable?.clear();
        this._onPointerDownObservable?.clear();
        this._onPointerUpObservable?.clear();
        this._onPointerCancelObservable?.clear();
        this._onPointerGotCaptureObservable?.clear();
        this._onPointerLostCaptureObservable?.clear();
        this._onWheelObservable?.clear();
        this._onPointerOverObservable = undefined;
        this._onPointerEnterObservable = undefined;
        this._onPointerOutObservable = undefined;
        this._onPointerLeaveObservable = undefined;
        this._onPointerMoveObservable = undefined;
        this._onPointerDownObservable = undefined;
        this._onPointerUpObservable = undefined;
        this._onPointerCancelObservable = undefined;
        this._onPointerGotCaptureObservable = undefined;
        this._onPointerLostCaptureObservable = undefined;
        this._onWheelObservable = undefined;
    }

    protected _attach(): void {
        const scene = this._getScene();
        if (!scene) {
            return;
        }
        this._prePointerObserver = scene.onPrePointerObservable.add(this._onPrePointer.bind(this));
    }

    protected _onPrePointer(pi: BABYLON.PointerInfoPre): void {
        // By default, Babylon.js types the event field in PointerInfo as IMouseEvent,
        // a simplified abstraction that does not expose pointerType, even though
        // under the hood, the actual value passed is a real PointerEvent in browsers
        // that support pointer events.
        const type = GetPointerType(pi);
        if (type === "mouse") {
            switch (pi.type) {
                case BABYLON.PointerEventTypes.POINTERMOVE: {
                    this._onPointerMove(pi);
                    break;
                }
                case BABYLON.PointerEventTypes.POINTERUP: {
                    this._onPointerUp(pi);
                    break;
                }
                case BABYLON.PointerEventTypes.POINTERDOWN: {
                    this._onPointerDown(pi);
                    break;
                }
                case BABYLON.PointerEventTypes.POINTERWHEEL: {
                    this._onWheel(pi);
                    break;
                }
                default: {
                    return;
                }
            }
        } else if (type === "touch") {
        }
    }

    private _onPointerDown(pointerInfo: BABYLON.PointerInfoPre): void {
        if (this._currentPosition) {
            const pixelXY = this._currentPosition;
            const base = pointerInfo.event as ITransformedPointerEvent;
            base.displayX = pixelXY.x;
            base.displayY = pixelXY.y;
            if (this._onPointerDownObservable && this._onPointerDownObservable.hasObservers()) {
                this._onPointerDownObservable.notifyObservers(base, -1, this, this);
            }
        }
    }

    private _onPointerUp(pointerInfo: BABYLON.PointerInfoPre): void {
        if (this._currentPosition) {
            const pixelXY = this._currentPosition;
            const base = pointerInfo.event as ITransformedPointerEvent;
            base.displayX = pixelXY.x;
            base.displayY = pixelXY.y;
            if (this._onPointerUpObservable && this._onPointerUpObservable.hasObservers()) {
                this._onPointerUpObservable.notifyObservers(base, -1, this._display, this);
            }
        }
    }

    private _onPointerMove(pointerInfo: BABYLON.PointerInfoPre): void {
        var scene = this._getScene();
        if (!scene) {
            return;
        }

        var meshUnderPointer = scene.meshUnderPointer;
        if (meshUnderPointer && meshUnderPointer !== this._display.node) {
            return;
        }

        const current = this._getPickingInfos(scene);
        const c = current?.getTextureCoordinates();
        if (c) {
            if (this._currentPosition) {
                pointerInfo.skipOnPointerObservable = true;
                // move
                //const pixelXY = this._display.getPixelToRef(current.pickedPoint);
                const pixelXY = this._display.getPixelToRef0(c);
                if (this._onPointerMoveObservable && this._onPointerMoveObservable.hasObservers()) {
                    const base = pointerInfo.event as ITransformedPointerEvent;
                    base.displayX = pixelXY.x;
                    base.displayY = pixelXY.y;
                    base.userCoordinates = c;
                    this._onPointerMoveObservable.notifyObservers(base, -1, this._display, this);
                }
                this._currentPosition = pixelXY;
                return;
            }

            pointerInfo.skipOnPointerObservable = true;
            // enter
            if (this._onPointerEnterObservable && this._onPointerEnterObservable.hasObservers()) {
                const base = pointerInfo.event as ITransformedPointerEvent;
                base.displayX = 0;
                base.displayY = 0;
                this._onPointerEnterObservable.notifyObservers(base, -1, this._display, this);
            }
            // then move
            const pixelXY = this._display.getPixelToRef0(c);
            if (this._onPointerMoveObservable && this._onPointerMoveObservable.hasObservers()) {
                const base = pointerInfo.event as ITransformedPointerEvent;
                base.displayX = 0;
                base.displayY = 0;
                base.userCoordinates = c;
                this._onPointerMoveObservable.notifyObservers(base, -1, this._display, this);
            }
            this._currentPosition = pixelXY;
            return;
        }
        // out
        if (this._onPointerOutObservable && this._onPointerOutObservable.hasObservers()) {
            const base = pointerInfo.event as ITransformedPointerEvent;
            base.displayX = 0;
            base.displayY = 0;
            this._onPointerOutObservable.notifyObservers(base, -1, this._display, this);
        }
        this._currentPosition = null;
    }

    private _onWheel(pointerInfo: BABYLON.PointerInfoPre): void {
        if (this._currentPosition) {
            pointerInfo.skipOnPointerObservable = true;
            const e = pointerInfo.event as WheelEvent;
            if (this._onWheelObservable && this._onWheelObservable.hasObservers()) {
                this._onWheelObservable.notifyObservers(e, -1, this.display, this);
            }
        }
    }

    protected _getPickingInfos(scene: BABYLON.Scene): BABYLON.Nullable<BABYLON.PickingInfo> {
        var pickinfo = scene.pick(scene.pointerX, scene.pointerY, this._pickFilter.bind(this));
        if (pickinfo.hit) {
            return pickinfo;
        }
        return null;
    }

    protected _pickFilter(mesh: BABYLON.Nullable<any>): boolean {
        return mesh == this._display.node;
    }

    protected _getScene(): BABYLON.Scene {
        return this._display.getScene();
    }
}
