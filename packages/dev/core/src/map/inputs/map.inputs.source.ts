import { IDisposable, Nullable } from "../../types";
import { ICartesian4 } from "../../geometry";
import { InputsNavigationTarget } from "./map.inputs.navigation";
import { IPointerSource } from "./map.inputs.interfaces";
import { EventState, Observer } from "../../events";

/// <summary>
/// Pointer input controller. Map basic pointer source event and forward them to the target.
/// </summary>
export class PointerController<T extends IPointerSource<T>> implements IDisposable {
    _src: T;
    _target: InputsNavigationTarget<T>;
    _moveObserver?: Nullable<Observer<ICartesian4>>;
    _downObserver?: Nullable<Observer<ICartesian4>>;
    _upObserver?: Nullable<Observer<ICartesian4>>;
    _wheelObserver?: Nullable<Observer<ICartesian4>>;

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

    protected _onPointerMove(v: ICartesian4, e: EventState) {
        this._target?.onPointerMove(this._src, v.x, v.y, v.z);
    }
    protected _onPointerDown(v: ICartesian4, e: EventState) {
        this._target?.onPointerDown(this._src, v.x, v.y, v.z, v.w);
    }
    protected _onPointerUp(v: ICartesian4, e: EventState) {
        this._target?.onPointerUp(this._src, v.x, v.y, v.z, v.w);
    }
    protected _onWheel(v: ICartesian4, e: EventState) {
        this._target?.onWheel(this._src, v.y);
    }
}
