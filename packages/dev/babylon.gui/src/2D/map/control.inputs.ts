import { Control, Vector2WithInfo } from "@babylonjs/gui";
import { EventState, Nullable, Observer, Vector2 } from "@babylonjs/core";
import { IDisposable } from "core/types";
import { InputsNavigationTarget } from "core/map";

type SourceType = Control;

/// <summary>
/// Mouse input controller. Map basic mouse event and forward them to the target.
/// </summary>
export class ControlInputController<T extends SourceType> implements IDisposable {
    _src: T;
    _target: InputsNavigationTarget<T>;
    _moveObserver?: Nullable<Observer<Vector2>>;
    _downObserver?: Nullable<Observer<Vector2WithInfo>>;
    _upObserver?: Nullable<Observer<Vector2WithInfo>>;
    _wheelObserver?: Nullable<Observer<Vector2>>;

    public constructor(src: T, target: InputsNavigationTarget<T>) {
        this._src = src;
        this._target = target;
        this._attachControl(this._src);
    }

    public dispose(): void {
        if (this._src) {
            this._detachControl(this._src);
        }
    }

    protected _attachControl(src: T) {
        this._moveObserver = src.onPointerMoveObservable.add(this._onPointerMove.bind(this));
        this._downObserver = src.onPointerDownObservable.add(this._onPointerDown.bind(this));
        this._upObserver = src.onPointerUpObservable.add(this._onPointerUp.bind(this));
        this._wheelObserver = src.onWheelObservable.add(this._onWheel.bind(this));
        src.isPointerBlocker = true; // prevent parent controls to get the pointer events and block them - without this line, drag does not work.
    }

    protected _detachControl(src: T) {
        if (this._moveObserver) {
            src.onPointerMoveObservable.remove(this._moveObserver);
        }
        if (this._downObserver) {
            src.onPointerDownObservable.remove(this._downObserver);
        }
        if (this._upObserver) {
            src.onPointerUpObservable.remove(this._upObserver);
        }
        if (this._wheelObserver) {
            src.onWheelObservable.remove(this._wheelObserver);
        }
    }

    protected _onPointerMove(v: Vector2, e: EventState) {
        this._target?.onPointerMove(this._src, v.x, v.y, 0);
    }
    protected _onPointerDown(v: Vector2WithInfo, e: EventState) {
        this._target?.onPointerDown(this._src, v.x, v.y, 0, v.buttonIndex);
    }
    protected _onPointerUp(v: Vector2WithInfo, e: EventState) {
        this._target?.onPointerUp(this._src, v.x, v.y, 0, v.buttonIndex);
    }
    protected _onWheel(v: Vector2, e: EventState) {
        this._target?.onWheel(this._src, v.y);
    }
}
