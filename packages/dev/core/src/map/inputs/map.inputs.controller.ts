import { Observable } from "../../events";
import { IDisposable } from "../../types";
import { PointerToDragController } from "./map.inputs.controller.drag";
import { PointerToGestureController } from "./map.inputs.controller.touch";
import { IDragSource, IInputSource, IPointerDragEvent } from "./map.inputs.interfaces";
import { AnyTouchGesture, ITouchGestureSource } from "./map.inputs.interfaces.touch";

/// <summary>
/// InputControllerBase is a DOM-to-PointerSource controller that emits pointer-related
/// observables based on native DOM PointerEvents.
/// It automatically attaches event listeners lazily as consumers access each observable.
/// It also prevents the default browser context menu via `contextmenu` events.
/// Note: The `contextmenu` event is a `MouseEvent`, not a `PointerEvent`, and is handled accordingly.
/// </summary>
export class InputController<T extends HTMLCanvasElement> implements IInputSource, IDisposable {
    _src?: T;

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
    _touchController?: ITouchGestureSource;

    public constructor(src: T) {
        this.source = src;
        this._dragController = new PointerToDragController(this);
    }

    public get onDragObservable(): Observable<IPointerDragEvent> {
        return this._dragController.onDragObservable;
    }

    public get onTouchObservable(): Observable<AnyTouchGesture> {
        if (!this._touchController) {
            this._touchController = new PointerToGestureController(this);
        }
        return this._touchController.onTouchObservable;
    }

    public get onWheelObservable(): Observable<WheelEvent> {
        if (!this._onWheelObservable) {
            this._onWheelObservable = new Observable<WheelEvent>();
            this._src?.addEventListener("wheel", this._onWheel);
        }
        return this._onWheelObservable;
    }

    public get onPointerOverObservable(): Observable<PointerEvent> {
        if (!this._onPointerOverObservable) {
            this._onPointerOverObservable = new Observable<PointerEvent>();
            this._src?.addEventListener("pointerover", (ev: PointerEvent) => {
                this._onPointerOverObservable?.notifyObservers(ev);
            });
        }
        return this._onPointerOverObservable;
    }
    public get onPointerEnterObservable(): Observable<PointerEvent> {
        if (!this._onPointerEnterObservable) {
            this._onPointerEnterObservable = new Observable<PointerEvent>();

            this._src?.addEventListener("pointerenter", this._onPointerEnter);
        }
        return this._onPointerEnterObservable;
    }
    public get onPointerOutObservable(): Observable<PointerEvent> {
        if (!this._onPointerOutObservable) {
            this._onPointerOutObservable = new Observable<PointerEvent>();
            this._src?.addEventListener("pointerout", this._onPointerOut);
        }
        return this._onPointerOutObservable;
    }

    public get onPointerLeaveObservable(): Observable<PointerEvent> {
        if (!this._onPointerLeaveObservable) {
            this._onPointerLeaveObservable = new Observable<PointerEvent>();
            this._src?.addEventListener("pointerleave", this._onPointerLeave);
        }
        return this._onPointerLeaveObservable;
    }
    public get onPointerMoveObservable(): Observable<PointerEvent> {
        if (!this._onPointerMoveObservable) {
            this._onPointerMoveObservable = new Observable<PointerEvent>();
            this._src?.addEventListener("pointermove", this._onPointerMove);
        }
        return this._onPointerMoveObservable;
    }
    public get onPointerDownObservable(): Observable<PointerEvent> {
        if (!this._onPointerDownObservable) {
            this._onPointerDownObservable = new Observable<PointerEvent>();
            this._src?.addEventListener("pointerdown", this._onPointerDown);
        }
        return this._onPointerDownObservable;
    }
    public get onPointerUpObservable(): Observable<PointerEvent> {
        if (!this._onPointerUpObservable) {
            this._onPointerUpObservable = new Observable<PointerEvent>();
            this._src?.addEventListener("pointerup", this._onPointerUp);
        }
        return this._onPointerUpObservable;
    }
    public get onPointerCancelObservable(): Observable<PointerEvent> {
        if (!this._onPointerCancelObservable) {
            this._onPointerCancelObservable = new Observable<PointerEvent>();
            this._src?.addEventListener("pointercancel", this._onPointerCancel);
        }
        return this._onPointerCancelObservable;
    }

    public get onPointerGotCaptureObservable(): Observable<PointerEvent> {
        if (!this._onPointerGotCaptureObservable) {
            this._onPointerGotCaptureObservable = new Observable<PointerEvent>();
            this._src?.addEventListener("gotpointercapture", this._onPointerGotCapture);
        }
        return this._onPointerGotCaptureObservable;
    }

    public get onPointerLostCaptureObservable(): Observable<PointerEvent> {
        if (!this._onPointerLostCaptureObservable) {
            this._onPointerLostCaptureObservable = new Observable<PointerEvent>();
            this._src?.addEventListener("lostpointercapture", this._onPointerLostCapture);
        }
        return this._onPointerLostCaptureObservable;
    }

    public get source(): T | undefined {
        return this._src;
    }

    public set source(src: T) {
        if (src !== this._src) {
            this._detachControl(this._src);
            this._src = src;
            this._attachControl(src);
        }
    }

    public dispose(): void {
        this._detachControl(this._src);
        this._clearObservables();
    }

    protected _attachControl(src?: T) {
        if (src) {
            src.addEventListener("contextmenu", this._onContextMenu.bind(this));

            if (this._onPointerOverObservable) {
                src.addEventListener("pointerover", this._onPointerOver.bind(this));
            }
            if (this._onPointerEnterObservable) {
                src.addEventListener("pointerenter", this._onPointerEnter.bind(this));
            }
            if (this._onPointerOutObservable) {
                src.addEventListener("pointerout", this._onPointerOut.bind(this));
            }
            if (this._onPointerLeaveObservable) {
                src.addEventListener("pointerleave", this._onPointerLeave.bind(this));
            }
            if (this._onPointerMoveObservable) {
                src.addEventListener("pointermove", this._onPointerMove.bind(this), { passive: false });
            }
            if (this._onPointerDownObservable) {
                src.addEventListener("pointerdown", this._onPointerDown);
            }
            if (this._onPointerUpObservable) {
                src.addEventListener("pointerup", this._onPointerUp.bind(this));
            }
            if (this._onPointerCancelObservable) {
                src.addEventListener("pointercancel", this._onPointerCancel.bind(this));
            }
            if (this._onPointerGotCaptureObservable) {
                src.addEventListener("gotpointercapture", this._onPointerGotCapture.bind(this));
            }
            if (this._onPointerLostCaptureObservable) {
                src.addEventListener("lostpointercapture", this._onPointerLostCapture.bind(this));
            }
            if (this._onWheelObservable) {
                src.addEventListener("wheel", this._onWheel.bind(this));
            }
        }
    }

    protected _detachControl(src?: T) {
        if (src) {
            src.removeEventListener("contextmenu", this._onContextMenu);
            src.removeEventListener("pointerover", this._onPointerOver);
            src.removeEventListener("pointerenter", this._onPointerEnter);
            src.removeEventListener("pointerout", this._onPointerOut);
            src.removeEventListener("pointerleave", this._onPointerLeave);
            src.removeEventListener("pointermove", this._onPointerMove);
            src.removeEventListener("pointerdown", this._onPointerDown);
            src.removeEventListener("pointerup", this._onPointerUp);
            src.removeEventListener("pointercancel", this._onPointerCancel);
            src.removeEventListener("gotpointercapture", this._onPointerGotCapture);
            src.removeEventListener("lostpointercapture", this._onPointerLostCapture);
            src.removeEventListener("wheel", this._onWheel);
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

    protected _onContextMenu = (ev: MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
    };

    protected _onWheel = (ev: WheelEvent): void => {
        this._onWheelObservable?.notifyObservers(ev);
    };

    protected _onPointerOver = (ev: PointerEvent): void => {
        this._onPointerOverObservable?.notifyObservers(ev);
    };
    protected _onPointerEnter = (ev: PointerEvent): void => {
        this._onPointerEnterObservable?.notifyObservers(ev);
    };
    protected _onPointerOut = (ev: PointerEvent): void => {
        this._onPointerOutObservable?.notifyObservers(ev);
    };
    protected _onPointerLeave = (ev: PointerEvent): void => {
        this._onPointerLeaveObservable?.notifyObservers(ev);
    };
    protected _onPointerMove = (ev: PointerEvent): void => {
        this._onPointerMoveObservable?.notifyObservers(ev);
    };
    protected _onPointerDown = (ev: PointerEvent): void => {
        this._onPointerDownObservable?.notifyObservers(ev);
    };
    protected _onPointerUp = (ev: PointerEvent): void => {
        this._onPointerUpObservable?.notifyObservers(ev);
    };
    protected _onPointerCancel = (ev: PointerEvent): void => {
        this._onPointerCancelObservable?.notifyObservers(ev);
    };
    protected _onPointerGotCapture = (ev: PointerEvent): void => {
        this._onPointerGotCaptureObservable?.notifyObservers(ev);
    };
    protected _onPointerLostCapture = (ev: PointerEvent): void => {
        this._onPointerLostCaptureObservable?.notifyObservers(ev);
    };
}
