import { IDisposable } from "../../types";
import { InputsNavigationTarget } from "./map.inputs.navigation";

export class InputControllerBase<T extends HTMLElement> implements IDisposable {
    _src: T;
    _target: InputsNavigationTarget<T>;

    public constructor(src: T, target: InputsNavigationTarget<T>) {
        this._src = src;
        this._target = target;
    }

    public get target(): InputsNavigationTarget<T> {
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
