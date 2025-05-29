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

export class TransformedPointerToGestureController extends PointerToGestureController {
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

    _meshUnderPointer?: BABYLON.Nullable<BABYLON.AbstractMesh>;
    _dragController: IDragSource;
    _touchController?: ITouchGestureSource;

    _display: VirtualDisplay;
    _prePointerObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.PointerInfoPre>>;
    _lastX = -1;
    _lastY = -1;
    _cache: BABYLON.Vector2;

    public constructor(display: VirtualDisplay) {
        this._display = display;
        this._prePointerObserver = null;
        this._cache = BABYLON.Vector2.Zero();
        this._attach();
        this._dragController = new TransformedPointerToDragController(this);
    }

    public get display(): VirtualDisplay {
        return this._display;
    }

    public get onTouchObservable(): Observable<AnyTouchGesture> {
        if (!this._touchController) {
            this._touchController = new TransformedPointerToGestureController(this);
        }
        return this._touchController.onTouchObservable;
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
        if (!this._display.node) {
            return; // no display node, nothing to do
        }

        const scene = this._getScene();
        if (!scene) {
            return; // no scene, nothing to do
        }

        // We only handle pointer events that are relevant to the display
        // the reason is that i=on pre-event, the picking info is not yet available,
        // and doing pick is expensive, so we want to avoid it unless necessary.

        if (pi.type === BABYLON.PointerEventTypes.POINTERMOVE) {
            // pointer move events are the most frequent, so we want to avoid
            // processing them if the pointer did not actually move. (yes, this can happen)
            if (this._lastX === pi.event.clientX && this._lastY === pi.event.clientY) {
                return; // no movement, skip
            }
            this._lastX = pi.event.clientX;
            this._lastY = pi.event.clientY;
        }
        if (!this._isPointerInsideMeshScreenBounds(pi.event.clientX, pi.event.clientY, this._display.node, scene)) {
            // If the pointer is not inside the mesh screen bounds, we skip further processing
            return;
        }

        // By default, Babylon.js types the event field in PointerInfo as IMouseEvent,
        // a simplified abstraction that does not expose pointerType, even though
        // under the hood, the actual value passed is a real PointerEvent in browsers
        // that support pointer events.

        switch (pi.type) {
            case BABYLON.PointerEventTypes.POINTERMOVE: {
                this._onPointerMove(pi, scene);
                break;
            }
            case BABYLON.PointerEventTypes.POINTERUP: {
                this._onPointerUp(pi, scene);
                break;
            }
            case BABYLON.PointerEventTypes.POINTERDOWN: {
                this._onPointerDown(pi, scene);
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
    }

    private _getBasePointer(pointerInfo: BABYLON.PointerInfoPre, current?: BABYLON.Nullable<BABYLON.PickingInfo>): ITransformedPointerEvent {
        const base = pointerInfo.event as ITransformedPointerEvent;
        current = current ?? this._getPickingInfos(this._getScene());
        const c = current?.getTextureCoordinates();
        if (c) {
            const pixelXY = this._display.getPixelToRef(c, this._cache);
            base.displayX = pixelXY.x;
            base.displayY = pixelXY.y;
            base.userCoordinates = c;
        } else {
            base.displayX = 0;
            base.displayY = 0;
        }

        return base;
    }

    private _onPointerDown(pointerInfo: BABYLON.PointerInfoPre, scene: BABYLON.Scene): void {
        var pick = this._getPickingInfos(scene);
        var meshUnderPointer = pick ? pick.pickedMesh : scene.meshUnderPointer;
        if (meshUnderPointer !== this._display.node) {
            return; // not on the display node
        }
        pointerInfo.skipOnPointerObservable = true;
        if (this._onPointerDownObservable && this._onPointerDownObservable.hasObservers()) {
            const base = this._getBasePointer(pointerInfo, pick);
            this._onPointerDownObservable.notifyObservers(base, -1, this._display, this);
        }
    }

    private _onPointerUp(pointerInfo: BABYLON.PointerInfoPre, scene: BABYLON.Scene): void {
        var pick = this._getPickingInfos(scene);
        var meshUnderPointer = pick ? pick.pickedMesh : scene.meshUnderPointer;
        if (meshUnderPointer !== this._display.node) {
            return; // not on the display node
        }
        pointerInfo.skipOnPointerObservable = true;
        if (this._onPointerUpObservable && this._onPointerUpObservable.hasObservers()) {
            const base = this._getBasePointer(pointerInfo, pick);
            this._onPointerUpObservable.notifyObservers(base, -1, this._display, this);
        }
    }

    private _onPointerMove(pointerInfo: BABYLON.PointerInfoPre, scene: BABYLON.Scene): void {
        var pick = this._getPickingInfos(scene);
        var meshUnderPointer = pick ? pick.pickedMesh : scene.meshUnderPointer;
        if (this._meshUnderPointer !== meshUnderPointer) {
            if (this._meshUnderPointer) {
                // pointer left the previous mesh
                if (this._meshUnderPointer === this._display.node) {
                    // was the display node
                    if (this._onPointerLeaveObservable && this._onPointerLeaveObservable.hasObservers()) {
                        const base = pointerInfo.event as ITransformedPointerEvent;
                        base.displayX = 0;
                        base.displayY = 0;
                        this._onPointerLeaveObservable.notifyObservers(base, -1, this._display, this);
                    }
                    pointerInfo.skipOnPointerObservable = true;
                }
            }
            if (meshUnderPointer) {
                // pointer entered a new mesh
                if (meshUnderPointer === this._display.node) {
                    // entered the display node
                    if (this._onPointerEnterObservable && this._onPointerEnterObservable.hasObservers()) {
                        const base = this._getBasePointer(pointerInfo, pick);
                        this._onPointerEnterObservable.notifyObservers(base, -1, this._display, this);
                    }
                    pointerInfo.skipOnPointerObservable = true;
                }
            }

            this._meshUnderPointer = meshUnderPointer;
            return;
        }

        if (this._meshUnderPointer != this._display.node) {
            return; // not on the display node
        }

        if (this._onPointerMoveObservable && this._onPointerMoveObservable.hasObservers()) {
            const base = this._getBasePointer(pointerInfo, pick);
            this._onPointerMoveObservable.notifyObservers(base, -1, this._display, this);
        }
    }

    private _onWheel(pointerInfo: BABYLON.PointerInfoPre): void {
        if (this._meshUnderPointer === this._display.node) {
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

    protected _isPointerInsideMeshScreenBounds(x: number, y: number, mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene): boolean {
        const positions = mesh.getBoundingInfo().boundingBox.vectorsWorld;

        if (!positions || positions.length === 0) {
            return false; // No positions to project
        }
        const projected = positions.map((v) =>
            BABYLON.Vector3.Project(
                v,
                BABYLON.Matrix.Identity(),
                scene.getTransformMatrix(),
                scene.activeCamera!.viewport.toGlobal(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight())
            )
        );

        // Calcule la bounding box 2D
        const minX = Math.min(...projected.map((p) => p.x));
        const maxX = Math.max(...projected.map((p) => p.x));
        const minY = Math.min(...projected.map((p) => p.y));
        const maxY = Math.max(...projected.map((p) => p.y));

        // Test si le pointeur est dans ce rectangle
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
}
