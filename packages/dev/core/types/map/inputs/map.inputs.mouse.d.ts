import { IDisposable } from "../../types";
import { InputsNavigationTarget } from "./map.inputs.navigation";
type InputListenerType<K extends keyof HTMLElementEventMap> = (this: HTMLElement, ev: HTMLElementEventMap[K]) => any;
export declare class MouseInputController<T extends HTMLElement> implements IDisposable {
    _src: T;
    _target: InputsNavigationTarget<T>;
    _ctxMenu: InputListenerType<"contextmenu">;
    _mouseDown: InputListenerType<"mousedown">;
    _mouseMove: InputListenerType<"mousemove">;
    _mouseUp: InputListenerType<"mouseup">;
    _wheel: InputListenerType<"wheel">;
    constructor(src: T, target: InputsNavigationTarget<T>);
    dispose(): void;
    protected _attachControl(src: T): void;
    protected _detachControl(src: T): void;
}
export {};
