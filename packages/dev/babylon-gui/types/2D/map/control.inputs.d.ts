import { Control, Vector2WithInfo } from "@babylonjs/gui";
import { EventState, Nullable, Observer, Vector2 } from "@babylonjs/core";
import { IDisposable } from "core/types";
import { InputsNavigationTarget } from "core/map";
type SourceType = Control;
export declare class ControlInputController<T extends SourceType> implements IDisposable {
    _src: T;
    _target: InputsNavigationTarget<T>;
    _moveObserver?: Nullable<Observer<Vector2>>;
    _downObserver?: Nullable<Observer<Vector2WithInfo>>;
    _upObserver?: Nullable<Observer<Vector2WithInfo>>;
    _wheelObserver?: Nullable<Observer<Vector2>>;
    constructor(src: T, target: InputsNavigationTarget<T>);
    dispose(): void;
    protected _attachControl(src: T): void;
    protected _detachControl(src: T): void;
    protected _onPointerMove(v: Vector2, e: EventState): void;
    protected _onPointerDown(v: Vector2WithInfo, e: EventState): void;
    protected _onPointerUp(v: Vector2WithInfo, e: EventState): void;
    protected _onWheel(v: Vector2, e: EventState): void;
}
export {};
