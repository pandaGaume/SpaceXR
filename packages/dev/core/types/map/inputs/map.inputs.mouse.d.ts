import { InputControllerBase } from "./map.inputs.controller";
import { InputsNavigationMouseTarget } from "./map.inputs.navigation.mouse";
type InputListenerType<K extends keyof HTMLElementEventMap> = (this: HTMLElement, ev: HTMLElementEventMap[K]) => any;
export declare class MouseInputController<T extends HTMLElement> extends InputControllerBase<T> {
    _ctxMenu: InputListenerType<"contextmenu">;
    _mouseDown: InputListenerType<"mousedown">;
    _mouseMove: InputListenerType<"mousemove">;
    _mouseUp: InputListenerType<"mouseup">;
    _wheel: InputListenerType<"wheel">;
    _pointerDown: InputListenerType<"pointerdown">;
    constructor(src: T, target: InputsNavigationMouseTarget<T>);
    protected _attachControl(src: T): void;
    protected _detachControl(src: T): void;
}
export {};
