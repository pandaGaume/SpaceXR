import * as BABYLON from "@babylonjs/core";
import { VirtualDisplay } from "./display.virtual";
import { Cartesian2WithInfos, ICartesian2WithInfos, IPointerSource, IWheelSource } from "core/map/inputs";
import { Observable } from "core/events";

export class VirtualDisplayInputsSource implements IPointerSource, IWheelSource, BABYLON.IDisposable {
    _onPointerOverObservable?: Observable<ICartesian2WithInfos>;
    _onPointerEnterObservable?: Observable<ICartesian2WithInfos>;
    _onPointerOutObservable?: Observable<ICartesian2WithInfos>;
    _onPointerLeaveObservable?: Observable<ICartesian2WithInfos>;
    _onPointerMoveObservable?: Observable<ICartesian2WithInfos>;
    _onPointerDownObservable?: Observable<ICartesian2WithInfos>;
    _onPointerUpObservable?: Observable<ICartesian2WithInfos>;
    _onPointerCancelObservable?: Observable<ICartesian2WithInfos>;
    _onPointerGotCaptureObservable?: Observable<ICartesian2WithInfos>;
    _onPointerLostCaptureObservable?: Observable<ICartesian2WithInfos>;

    _onWheelObservable?: Observable<number>;

    _display: VirtualDisplay;
    _prePointerObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.PointerInfoPre>>;

    _currentPosition: BABYLON.Nullable<BABYLON.Vector2>;

    public constructor(display: VirtualDisplay) {
        this._display = display;
        this._prePointerObserver = null;
        this._currentPosition = null;
        this._attach();
    }

    public get display(): VirtualDisplay {
        return this._display;
    }

    public get onPointerOverObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerOverObservable) {
            this._onPointerOverObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerOverObservable;
    }

    public get onPointerEnterObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerEnterObservable) {
            this._onPointerEnterObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerEnterObservable;
    }

    public get onPointerOutObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerOutObservable) {
            this._onPointerOutObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerOutObservable;
    }

    public get onPointerLeaveObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerLeaveObservable) {
            this._onPointerLeaveObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerLeaveObservable;
    }

    public get onPointerMoveObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerMoveObservable) {
            this._onPointerMoveObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerMoveObservable;
    }

    public get onPointerDownObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerDownObservable) {
            this._onPointerDownObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerDownObservable;
    }

    public get onPointerUpObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerUpObservable) {
            this._onPointerUpObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerUpObservable;
    }

    public get onPointerCancelObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerCancelObservable) {
            this._onPointerCancelObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerCancelObservable;
    }

    public get onPointerGotCaptureObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerGotCaptureObservable) {
            this._onPointerGotCaptureObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerGotCaptureObservable;
    }

    public get onPointerLostCaptureObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerLostCaptureObservable) {
            this._onPointerLostCaptureObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerLostCaptureObservable;
    }

    public get onWheelObservable(): Observable<number> {
        if (!this._onWheelObservable) {
            this._onWheelObservable = new Observable<number>();
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
    }

    protected _attach(): void {
        const scene = this._getScene();
        if (!scene) {
            return;
        }
        this._prePointerObserver = scene.onPrePointerObservable.add(this._onPrePointer.bind(this));
    }

    protected _onPrePointer(pi: BABYLON.PointerInfoPre): void {
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
    }

    private _onPointerDown(pointerInfo: BABYLON.PointerInfoPre): void {
        if (this._currentPosition) {
            const pixelXY = this._currentPosition;
            const e = new Cartesian2WithInfos(pixelXY.x, pixelXY.y, pointerInfo.event.button);
            if (this._onPointerDownObservable && this._onPointerDownObservable.hasObservers()) {
                this._onPointerDownObservable.notifyObservers(e, -1, this, this);
            }
        }
    }

    private _onPointerUp(pointerInfo: BABYLON.PointerInfoPre): void {
        if (this._currentPosition) {
            const pixelXY = this._currentPosition;
            const e = new Cartesian2WithInfos(pixelXY.x, pixelXY.y, pointerInfo.event.button);
            if (this._onPointerUpObservable && this._onPointerUpObservable.hasObservers()) {
                this._onPointerUpObservable.notifyObservers(e, -1, this._display, this);
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
        if (current && current.pickedPoint) {
            if (this._currentPosition) {
                pointerInfo.skipOnPointerObservable = true;
                // move
                const pixelXY = this._display.getPixelToRef(current.pickedPoint);
                if (this._onPointerMoveObservable && this._onPointerMoveObservable.hasObservers()) {
                    const buttonIndex = (<any>pointerInfo.event).button;
                    const pointerId = (<any>pointerInfo.event).pointerId;
                    const e = new Cartesian2WithInfos(pixelXY.x, pixelXY.y, buttonIndex, pointerId);
                    const c = current.getTextureCoordinates();
                    if (c) {
                        e.textureCoordinates = c;
                    }
                    this._onPointerMoveObservable.notifyObservers(e, -1, this._display, this);
                }
                this._currentPosition = pixelXY;
                return;
            }

            pointerInfo.skipOnPointerObservable = true;
            // enter
            if (this._onPointerEnterObservable && this._onPointerEnterObservable.hasObservers()) {
                const buttonIndex = (<any>pointerInfo.event).button;
                const pointerId = (<any>pointerInfo.event).pointerId;
                const e = new Cartesian2WithInfos(0, 0, buttonIndex, pointerId);
                this._onPointerEnterObservable.notifyObservers(e, -1, this._display, this);
            }
            // then move
            const pixelXY = this._display.getPixelToRef(current.pickedPoint);
            if (this._onPointerMoveObservable && this._onPointerMoveObservable.hasObservers()) {
                const buttonIndex = (<any>pointerInfo.event).button;
                const pointerId = (<any>pointerInfo.event).pointerId;
                const e = new Cartesian2WithInfos(0, 0, buttonIndex, pointerId);

                this._onPointerMoveObservable.notifyObservers(e, -1, this._display, this);
            }
            this._currentPosition = pixelXY;
            return;
        }
        // out
        if (this._onPointerOutObservable && this._onPointerOutObservable.hasObservers()) {
            const buttonIndex = (<any>pointerInfo.event).button;
            const pointerId = (<any>pointerInfo.event).pointerId;
            const e = new Cartesian2WithInfos(0, 0, buttonIndex, pointerId);
            this._onPointerOutObservable.notifyObservers(e, -1, this._display, this);
        }
        this._currentPosition = null;
    }

    private _onWheel(pointerInfo: BABYLON.PointerInfoPre): void {
        if (this._currentPosition) {
            pointerInfo.skipOnPointerObservable = true;
            const e = pointerInfo.event as WheelEvent;
            if (this._onWheelObservable && this._onWheelObservable.hasObservers()) {
                this._onWheelObservable.notifyObservers(e.deltaY, -1, this.display, this);
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
