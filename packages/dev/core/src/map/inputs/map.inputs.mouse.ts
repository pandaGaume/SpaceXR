import { InputControllerBase } from "./map.inputs.controller";
import { InputsNavigationTarget } from "./map.inputs.navigation";

type InputListenerType<K extends keyof HTMLElementEventMap> = (this: HTMLElement, ev: HTMLElementEventMap[K]) => any;

/// <summary>
/// Mouse input controller. Map basic mouse event and forward them to the target.
/// </summary>
export class MouseInputController<T extends HTMLElement> extends InputControllerBase<T> {
    _ctxMenu: InputListenerType<"contextmenu">;
    _mouseDown: InputListenerType<"mousedown">;
    _mouseMove: InputListenerType<"mousemove">;
    _mouseUp: InputListenerType<"mouseup">;
    _wheel: InputListenerType<"wheel">;
    _pointerDown: InputListenerType<"pointerdown">;

    public constructor(src: T, target: InputsNavigationTarget<T>) {
        super(src, target);
        this._ctxMenu = (ev: MouseEvent) => {
            ev.preventDefault();
            ev.stopPropagation();
        };
        this._mouseDown = ((ev: MouseEvent) => {
            this.target?.onPointerDown(this.source, ev.clientX, ev.clientY, ev.button);
        }).bind(this);
        this._mouseMove = ((ev: MouseEvent) => {
            this.target?.onPointerMove(this.source, ev.clientX, ev.clientY);
        }).bind(this);
        this._mouseUp = ((ev: MouseEvent) => {
            this.target?.onPointerUp(this.source, ev.clientX, ev.clientY, ev.button);
        }).bind(this);
        this._wheel = ((ev: WheelEvent) => {
            this.target?.onWheel(this.source, ev.deltaY);
        }).bind(this);

        // this is to let touch behave has mouse...
        this._pointerDown = (ev: PointerEvent) => {
            const e: HTMLElement = ev.target as HTMLElement;
            if (e?.hasPointerCapture(ev.pointerId)) {
                e?.releasePointerCapture(ev.pointerId);
            }
        };
    }

    protected _attachControl(src: T) {
        src.addEventListener("contextmenu", this._ctxMenu);
        src.addEventListener("mousedown", this._mouseDown);
        src.addEventListener("mousemove", this._mouseMove);
        src.addEventListener("mouseup", this._mouseUp);
        src.addEventListener("wheel", this._wheel);
        src.addEventListener("pointerdown", this._pointerDown);
    }
    protected _detachControl(src: T) {
        src.removeEventListener("contextmenu", this._ctxMenu);
        src.removeEventListener("mousedown", this._mouseDown);
        src.removeEventListener("mousemove", this._mouseMove);
        src.removeEventListener("mouseup", this._mouseUp);
        src.removeEventListener("wheel", this._wheel);
        src.removeEventListener("pointerdown", this._pointerDown);
    }
}
