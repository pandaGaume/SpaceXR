import { IDisposable } from "../../types";
import { InputsNavigationMouseTarget } from "./map.inputs.navigation.mouse";

export class InputControllerBase<T extends HTMLElement> implements IDisposable {
    _src: T;
    _target: InputsNavigationMouseTarget<T>;

    public constructor(src: T, target: InputsNavigationMouseTarget<T>) {
        this._src = src;
        this._target = target;
    }

    public get target(): InputsNavigationMouseTarget<T> {
        return this._target;
    }

    public get source(): T {
        return this._src;
    }

    public dispose(): void {
        this._detachControl(this._src);
    }

    protected _attachControl(src: T) {}
    protected _detachControl(src: T) {}
}
