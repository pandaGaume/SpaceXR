import { Observable } from "../../events";
import { IDisposable } from "../../types";
import { IPointerSource, IWheelSource } from "./map.inputs.interfaces";

/// <summary>
/// InputControllerBase is a DOM-to-PointerSource controller that emits pointer-related
/// observables based on native DOM PointerEvents.
/// It automatically attaches event listeners lazily as consumers access each observable.
/// It also prevents the default browser context menu via `contextmenu` events.
/// Note: The `contextmenu` event is a `MouseEvent`, not a `PointerEvent`, and is handled accordingly.
/// </summary>
export class InputControllerBase<T extends HTMLElement> implements IPointerSource, IWheelSource, IDisposable {
    _src: T;

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

    public constructor(src: T) {
        this._src = src;
    }

    public get onWheelObservable(): Observable<WheelEvent> {
        if (!this._onWheelObservable) {
            this._onWheelObservable = new Observable<WheelEvent>();
            this._src.addEventListener("wheel", this._onWheel);
        }
        return this._onWheelObservable;
    }

    public get onPointerOverObservable(): Observable<PointerEvent> {
        if (!this._onPointerOverObservable) {
            this._onPointerOverObservable = new Observable<PointerEvent>();
            this._src.addEventListener("pointerover", (ev: PointerEvent) => {
                this._onPointerOverObservable?.notifyObservers(ev);
            });
        }
        return this._onPointerOverObservable;
    }
    public get onPointerEnterObservable(): Observable<PointerEvent> {
        if (!this._onPointerEnterObservable) {
            this._onPointerEnterObservable = new Observable<PointerEvent>();

            this._src.addEventListener("pointerenter", this._onPointerEnter);
        }
        return this._onPointerEnterObservable;
    }
    public get onPointerOutObservable(): Observable<PointerEvent> {
        if (!this._onPointerOutObservable) {
            this._onPointerOutObservable = new Observable<PointerEvent>();
            this._src.addEventListener("pointerout", this._onPointerOut);
        }
        return this._onPointerOutObservable;
    }

    public get onPointerLeaveObservable(): Observable<PointerEvent> {
        if (!this._onPointerLeaveObservable) {
            this._onPointerLeaveObservable = new Observable<PointerEvent>();
            this._src.addEventListener("pointerleave", this._onPointerLeave);
        }
        return this._onPointerLeaveObservable;
    }
    public get onPointerMoveObservable(): Observable<PointerEvent> {
        if (!this._onPointerMoveObservable) {
            this._onPointerMoveObservable = new Observable<PointerEvent>();
            this._src.addEventListener("pointermove", this._onPointerMove);
        }
        return this._onPointerMoveObservable;
    }
    public get onPointerDownObservable(): Observable<PointerEvent> {
        if (!this._onPointerDownObservable) {
            this._onPointerDownObservable = new Observable<PointerEvent>();
            this._src.addEventListener("pointerdown", this._onPointerDown);
        }
        return this._onPointerDownObservable;
    }
    public get onPointerUpObservable(): Observable<PointerEvent> {
        if (!this._onPointerUpObservable) {
            this._onPointerUpObservable = new Observable<PointerEvent>();
            this._src.addEventListener("pointerup", this._onPointerUp);
        }
        return this._onPointerUpObservable;
    }
    public get onPointerCancelObservable(): Observable<PointerEvent> {
        if (!this._onPointerCancelObservable) {
            this._onPointerCancelObservable = new Observable<PointerEvent>();
            this._src.addEventListener("pointercancel", this._onPointerCancel);
        }
        return this._onPointerCancelObservable;
    }

    public get onPointerGotCaptureObservable(): Observable<PointerEvent> {
        if (!this._onPointerGotCaptureObservable) {
            this._onPointerGotCaptureObservable = new Observable<PointerEvent>();
            this._src.addEventListener("gotpointercapture", this._onPointerGotCapture);
        }
        return this._onPointerGotCaptureObservable;
    }

    public get onPointerLostCaptureObservable(): Observable<PointerEvent> {
        if (!this._onPointerLostCaptureObservable) {
            this._onPointerLostCaptureObservable = new Observable<PointerEvent>();
            this._src.addEventListener("lostpointercapture", this._onPointerLostCapture);
        }
        return this._onPointerLostCaptureObservable;
    }

    public get source(): T {
        return this._src;
    }

    public dispose(): void {
        this._detachControl(this._src);
        this._clearObservables();
    }

    protected _attachControl(src: T) {
        if (src !== this._src) {
            this._detachControl(this._src);
            this._src = src;
            if (this._src) {
                this._src.addEventListener("contextmenu", this._onContextMenu);

                if (this._onPointerOverObservable) {
                    this._src.addEventListener("pointerover", this._onPointerOver);
                }
                if (this._onPointerEnterObservable) {
                    this._src.addEventListener("pointerenter", this._onPointerEnter);
                }
                if (this._onPointerOutObservable) {
                    this._src.addEventListener("pointerout", this._onPointerOut);
                }
                if (this._onPointerLeaveObservable) {
                    this._src.addEventListener("pointerleave", this._onPointerLeave);
                }
                if (this._onPointerMoveObservable) {
                    this._src.addEventListener("pointermove", this._onPointerMove);
                }
                if (this._onPointerDownObservable) {
                    this._src.addEventListener("pointerdown", this._onPointerDown);
                }
                if (this._onPointerUpObservable) {
                    this._src.addEventListener("pointerup", this._onPointerUp);
                }
                if (this._onPointerCancelObservable) {
                    this._src.addEventListener("pointercancel", this._onPointerCancel);
                }
                if (this._onPointerGotCaptureObservable) {
                    this._src.addEventListener("gotpointercapture", this._onPointerGotCapture);
                }
                if (this._onPointerLostCaptureObservable) {
                    this._src.addEventListener("lostpointercapture", this._onPointerLostCapture);
                }
                if (this._onWheelObservable) {
                    this._src.addEventListener("wheel", this._onWheel);
                }
            }
        }
    }

    protected _detachControl(src: T) {
        if (src) {
            src.removeEventListener("contextmenu", this._onContextMenu);

            if (this._onPointerOverObservable) {
                src.removeEventListener("pointerover", this._onPointerOver);
            }
            if (this._onPointerEnterObservable) {
                src.removeEventListener("pointerenter", this._onPointerEnter);
            }
            if (this._onPointerOutObservable) {
                src.removeEventListener("pointerout", this._onPointerOut);
            }
            if (this._onPointerLeaveObservable) {
                src.removeEventListener("pointerleave", this._onPointerLeave);
            }
            if (this._onPointerMoveObservable) {
                src.removeEventListener("pointermove", this._onPointerMove);
            }
            if (this._onPointerDownObservable) {
                src.removeEventListener("pointerdown", this._onPointerDown);
            }
            if (this._onPointerUpObservable) {
                src.removeEventListener("pointerup", this._onPointerUp);
            }
            if (this._onPointerCancelObservable) {
                src.removeEventListener("pointercancel", this._onPointerCancel);
            }
            if (this._onPointerGotCaptureObservable) {
                src.removeEventListener("gotpointercapture", this._onPointerGotCapture);
            }
            if (this._onPointerLostCaptureObservable) {
                src.removeEventListener("lostpointercapture", this._onPointerLostCapture);
            }
            if (this._onWheelObservable) {
                src.removeEventListener("wheel", this._onWheel);
            }
        }
    }

    protected _clearObservables(): void {
        this._onWheelObservable?.clear();
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

    protected _onContextMenu(ev: MouseEvent): void {
        ev.preventDefault();
        ev.stopPropagation();
    }

    protected _onWheel(ev: WheelEvent): void {
        this._onWheelObservable?.notifyObservers(ev);
    }

    protected _onPointerOver(ev: PointerEvent): void {
        this._onPointerOverObservable?.notifyObservers(ev);
    }
    protected _onPointerEnter(ev: PointerEvent): void {
        this._onPointerEnterObservable?.notifyObservers(ev);
    }
    protected _onPointerOut(ev: PointerEvent): void {
        this._onPointerOutObservable?.notifyObservers(ev);
    }
    protected _onPointerLeave(ev: PointerEvent): void {
        this._onPointerLeaveObservable?.notifyObservers(ev);
    }
    protected _onPointerMove(ev: PointerEvent): void {
        this._onPointerMoveObservable?.notifyObservers(ev);
    }
    protected _onPointerDown(ev: PointerEvent): void {
        this._onPointerDownObservable?.notifyObservers(ev);
    }
    protected _onPointerUp(ev: PointerEvent): void {
        this._onPointerUpObservable?.notifyObservers(ev);
    }
    protected _onPointerCancel(ev: PointerEvent): void {
        this._onPointerCancelObservable?.notifyObservers(ev);
    }
    protected _onPointerGotCapture(ev: PointerEvent): void {
        this._onPointerGotCaptureObservable?.notifyObservers(ev);
    }
    protected _onPointerLostCapture(ev: PointerEvent): void {
        this._onPointerLostCaptureObservable?.notifyObservers(ev);
    }
}
