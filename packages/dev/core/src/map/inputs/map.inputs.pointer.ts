import { InputControllerBase } from "./map.inputs.controller";
import { InputsNavigationMouseTarget } from "./map.inputs.navigation.mouse";

type InputListenerType<K extends keyof HTMLElementEventMap> = (this: HTMLElement, ev: HTMLElementEventMap[K]) => any;

export class PointerInputController<T extends HTMLElement> extends InputControllerBase<T> {
    _events: Array<PointerEvent>;

    _ctxMenu: InputListenerType<"contextmenu">;
    _over: InputListenerType<"pointerover">;
    _enter: InputListenerType<"pointerenter">;
    _leave: InputListenerType<"pointerleave">;
    _out: InputListenerType<"pointerout">;
    _down: InputListenerType<"pointerdown">;
    _up: InputListenerType<"pointerup">;
    _move: InputListenerType<"pointermove">;
    _cancel: InputListenerType<"pointercancel">;
    _gotCapture: InputListenerType<"gotpointercapture">;
    _lostCapture: InputListenerType<"lostpointercapture">;

    _wheel: InputListenerType<"wheel">;

    public constructor(src: T, target: InputsNavigationMouseTarget<T>) {
        super(src, target);
        this._events = [];
        this._ctxMenu = this._onContextMenu.bind(this);
        this._over = this._onPointerOver.bind(this);
        this._enter = this._onPointerEnter.bind(this);
        this._leave = this._onPointerLeave.bind(this);
        this._out = this._onPointerOut.bind(this);
        this._down = this._onPointerDown.bind(this);
        this._up = this._onPointerUp.bind(this);
        this._move = this._onPointerMove.bind(this);
        this._cancel = this._onPointerCancel.bind(this);
        this._gotCapture = this._onGotCapture.bind(this);
        this._lostCapture = this._onLostCapture.bind(this);
        this._wheel = this._onWheel.bind(this);

        this._attachControl(src);
    }

    protected _attachControl(src: T) {
        src.addEventListener("contextmenu", this._ctxMenu);
        src.addEventListener("pointerover", this._over);
        src.addEventListener("pointerenter", this._enter);
        src.addEventListener("pointerleave", this._leave);
        src.addEventListener("pointerout", this._out);
        src.addEventListener("pointerdown", this._down);
        src.addEventListener("pointerup", this._up);
        src.addEventListener("pointermove", this._move);
        src.addEventListener("pointercancel", this._cancel);
        src.addEventListener("gotpointercapture", this._gotCapture);
        src.addEventListener("lostpointercapture", this._lostCapture);
        src.addEventListener("wheel", this._wheel);
    }

    protected _detachControl(src: T) {
        src.removeEventListener("contextmenu", this._ctxMenu);
        src.removeEventListener("pointerover", this._over);
        src.removeEventListener("pointerenter", this._enter);
        src.removeEventListener("pointerleave", this._leave);
        src.removeEventListener("pointerout", this._out);
        src.removeEventListener("pointerdown", this._down);
        src.removeEventListener("pointerup", this._up);
        src.removeEventListener("pointermove", this._move);
        src.removeEventListener("pointercancel", this._cancel);
        src.removeEventListener("gotpointercapture", this._gotCapture);
        src.removeEventListener("lostpointercapture", this._lostCapture);
        src.removeEventListener("wheel", this._wheel);
    }

    protected _onContextMenu(ev: MouseEvent) {
        ev.preventDefault();
        ev.stopPropagation();
    }

    protected _onPointerOver(ev: PointerEvent) {
        this.target?.onPointerOver(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }

    protected _onPointerEnter(ev: PointerEvent) {
        this.target?.onPointerEnter(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }

    protected _onPointerLeave(ev: PointerEvent) {
        this.target?.onPointerLeave(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }

    protected _onPointerOut(ev: PointerEvent) {
        this.target?.onPointerOut(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }

    protected _onPointerDown(ev: PointerEvent) {
        this.target?.onPointerDown(this.source, ev.clientX, ev.clientY, ev.button, ev.pointerId);
    }

    protected _onPointerUp(ev: PointerEvent) {
        this.target?.onPointerUp(this.source, ev.clientX, ev.clientY, ev.button, ev.pointerId);
    }

    protected _onPointerMove(ev: PointerEvent) {
        this.target?.onPointerMove(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }

    protected _onPointerCancel(ev: PointerEvent) {
        this.target?.onPointerCancel(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }

    protected _onGotCapture(ev: PointerEvent) {
        this.target?.onPointerGotCapture(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }

    protected _onLostCapture(ev: PointerEvent) {
        this.target?.onPointerLostCapture(this.source, ev.clientX, ev.clientY, ev.pointerId);
    }

    protected _onWheel(ev: WheelEvent) {
        this.target?.onWheel(this.source, ev.deltaY);
    }
}
