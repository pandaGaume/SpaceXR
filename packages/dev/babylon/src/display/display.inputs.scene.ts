import * as BABYLON from "@babylonjs/core";
import { VirtualDisplay } from "./display.virtual";
import { Cartesian2WithInfos, ICartesian2WithInfos, IPointerSource } from "core/map/inputs";
import { Observable } from "core/events";
import { ICartesian2 } from "core/geometry";

export class VirtualDisplayInputsSource implements IPointerSource<VirtualDisplayInputsSource>, BABYLON.IDisposable {
    _onPointerMoveObservable?: Observable<ICartesian2>;
    _onPointerOutObservable?: Observable<VirtualDisplayInputsSource>;
    _onPointerDownObservable?: Observable<ICartesian2WithInfos>;
    _onPointerUpObservable?: Observable<ICartesian2WithInfos>;
    _onPointerClickObservable?: Observable<ICartesian2WithInfos>;
    _onPointerEnterObservable?: Observable<VirtualDisplayInputsSource>;
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
                this._onPointerWheel(pi);
                break;
            }
            default: {
                return;
            }
        }
    }

    public get onPointerMoveObservable(): Observable<ICartesian2> {
        if (!this._onPointerMoveObservable) {
            this._onPointerMoveObservable = new Observable<ICartesian2>();
        }
        return this._onPointerMoveObservable;
    }

    public get onPointerOutObservable(): Observable<VirtualDisplayInputsSource> {
        if (!this._onPointerOutObservable) {
            this._onPointerOutObservable = new Observable<VirtualDisplayInputsSource>();
        }
        return this._onPointerOutObservable;
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

    public get onPointerClickObservable(): Observable<ICartesian2WithInfos> {
        if (!this._onPointerClickObservable) {
            this._onPointerClickObservable = new Observable<ICartesian2WithInfos>();
        }
        return this._onPointerClickObservable;
    }

    public get onPointerEnterObservable(): Observable<VirtualDisplayInputsSource> {
        if (!this._onPointerEnterObservable) {
            this._onPointerEnterObservable = new Observable<VirtualDisplayInputsSource>();
        }
        return this._onPointerEnterObservable;
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
        this._onPointerMoveObservable?.clear();
        this._onPointerOutObservable?.clear();
        this._onPointerDownObservable?.clear();
        this._onPointerUpObservable?.clear();
        this._onPointerClickObservable?.clear();
        this._onPointerEnterObservable?.clear();
        this._onWheelObservable?.clear();
    }

    private _onPointerDown(pointerInfo: BABYLON.PointerInfoPre): void {
        if (this._currentPosition) {
            const pixelXY = this._currentPosition; //this._display.getPixelToRef(pickedPoint);
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
        var meshUnderPointer = this._getScene().meshUnderPointer;
        if (meshUnderPointer && meshUnderPointer !== this._display) {
            return;
        }

        const current = this._getDisplayPosition();
        if (current) {
            if (this._currentPosition) {
                pointerInfo.skipOnPointerObservable = true;
                // move
                const pixelXY = this._display.getPixelToRef(current);
                if (this._onPointerMoveObservable && this._onPointerMoveObservable.hasObservers()) {
                    this._onPointerMoveObservable.notifyObservers(pixelXY, -1, this._display, this);
                }
                this._currentPosition = pixelXY;
                return;
            }

            pointerInfo.skipOnPointerObservable = true;
            // enter
            if (this._onPointerEnterObservable && this._onPointerEnterObservable.hasObservers()) {
                this._onPointerEnterObservable.notifyObservers(this, -1, this, this._display);
            }
            // then move
            const pixelXY = this._display.getPixelToRef(current);
            if (this._onPointerMoveObservable && this._onPointerMoveObservable.hasObservers()) {
                this._onPointerMoveObservable.notifyObservers(pixelXY, -1, this._display, this);
            }
            this._currentPosition = pixelXY;
            return;
        }
        // out
        if (this._onPointerOutObservable && this._onPointerOutObservable.hasObservers()) {
            this._onPointerOutObservable.notifyObservers(this, -1, this._display, this);
        }
        this._currentPosition = null;
    }

    private _onPointerWheel(pointerInfo: BABYLON.PointerInfoPre): void {
        if (this._currentPosition) {
            pointerInfo.skipOnPointerObservable = true;
            const e = pointerInfo.event as WheelEvent;
            if (this._onWheelObservable && this._onWheelObservable.hasObservers()) {
                this._onWheelObservable.notifyObservers(e.deltaY, -1, this.display, this);
            }
        }
    }

    protected _getDisplayPosition(): BABYLON.Nullable<BABYLON.Vector3> {
        var scene = this._getScene();

        var pickinfo = scene.pick(scene.pointerX, scene.pointerY, this._pickFilter.bind(this));
        if (pickinfo.hit) {
            return pickinfo.pickedPoint;
        }
        return null;
    }

    protected _pickFilter(mesh: BABYLON.Nullable<any>): boolean {
        return mesh == this._display;
    }

    protected _getScene(): BABYLON.Scene {
        return this._display.getScene();
    }
}
