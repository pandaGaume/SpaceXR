import { IDisposable } from "../../types";
import { InputsNavigationTarget } from "./map.inputs.navigation";

type InputListenerType<K extends keyof HTMLElementEventMap> = (this: HTMLElement, ev: HTMLElementEventMap[K]) => any;

/// <summary>
/// Mouse input controller. Map basic mouse event and forward them to the target.
/// </summary>
export class MouseInputController<T extends HTMLElement> implements IDisposable {
    _src: T;
    _target: InputsNavigationTarget<T>;

    _ctxMenu: InputListenerType<"contextmenu">;
    _mouseDown: InputListenerType<"mousedown">;
    _mouseMove: InputListenerType<"mousemove">;
    _mouseUp: InputListenerType<"mouseup">;
    _wheel: InputListenerType<"wheel">;

    public constructor(src: T, target: InputsNavigationTarget<T>) {
        this._src = src;
        this._target = target;
        this._ctxMenu = (ev: MouseEvent) => {
            ev.preventDefault();
            ev.stopPropagation();
        };
        this._mouseDown = ((ev: MouseEvent) => {
            this._target?.onPointerDown(this._src, ev.clientX, ev.clientY, 0, ev.button);
        }).bind(this);
        this._mouseMove = ((ev: MouseEvent) => {
            this._target?.onPointerMove(this._src, ev.clientX, ev.clientY,0);
        }).bind(this);
        this._mouseUp = ((ev: MouseEvent) => {
            this._target?.onPointerUp(this._src, ev.clientX, ev.clientY, 0,ev.button);
        }).bind(this);
        this._wheel = ((ev: WheelEvent) => {
            this._target?.onWheel(this._src, ev.deltaY);
        }).bind(this);
        if (this._src) {
            this._attachControl(this._src);
        }
    }

    public dispose(): void {
        if (this._src) {
            this._detachControl(this._src);
        }
    }

    protected _attachControl(src: T) {
        src.addEventListener("contextmenu", this._ctxMenu);
        src.addEventListener("mousedown", this._mouseDown);
        src.addEventListener("mousemove", this._mouseMove);
        src.addEventListener("mouseup", this._mouseUp);
        src.addEventListener("wheel", this._wheel);
    }

    protected _detachControl(src: T) {
        src.removeEventListener("contextmenu", this._ctxMenu);
        src.removeEventListener("mousedown", this._mouseDown);
        src.removeEventListener("mousemove", this._mouseMove);
        src.removeEventListener("mouseup", this._mouseUp);
        src.removeEventListener("wheel", this._wheel);
    }
}
