import { IDisposable, Nullable } from "../../types";
import { Cartesian2, ICartesian2 } from "../../geometry";
import { InputsNavigationTarget } from "./map.inputs.navigation";
import { ICartesian2WithInfos, IPointerSource } from "./map.inputs.interfaces";
import { EventState, Observer } from "../../events";

export class Cartesian2WithInfos extends Cartesian2 implements ICartesian2WithInfos {
    /** defines the current mouse button index */
    _buttonIndex: number;

    public constructor(public x: number, public y: number, buttonIndex?: number) {
        super(x, y);
        this._buttonIndex = buttonIndex ?? -1;
    }

    public get buttonIndex() {
        return this._buttonIndex;
    }
}

/// <summary>
/// Pointer input controller. Map basic pointer source event and forward them to the target.
/// </summary>
export class PointerController<S extends IPointerSource> implements IDisposable {
    _src: S;
    _target: InputsNavigationTarget<S>;
    _moveObserver?: Nullable<Observer<ICartesian2>>;
    _downObserver?: Nullable<Observer<ICartesian2WithInfos>>;
    _upObserver?: Nullable<Observer<ICartesian2WithInfos>>;
    _wheelObserver?: Nullable<Observer<number>>;

    public constructor(src: S, target: InputsNavigationTarget<S>) {
        this._src = src;
        this._target = target;
        this._attachControl(this._src);
    }

    public dispose(): void {
        if (this._src) {
            this._detachControl(this._src);
        }
    }

    protected _attachControl(src: S) {
        this._moveObserver = src.onPointerMoveObservable.add(this._onPointerMove.bind(this));
        this._downObserver = src.onPointerDownObservable.add(this._onPointerDown.bind(this));
        this._upObserver = src.onPointerUpObservable.add(this._onPointerUp.bind(this));
        this._wheelObserver = src.onWheelObservable.add(this._onWheel.bind(this));
    }

    protected _detachControl(src: S) {
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

    protected _onPointerMove(v: ICartesian2, e: EventState) {
        this._target?.onPointerMove(this._src, v.x, v.y);
    }
    protected _onPointerDown(v: ICartesian2WithInfos, e: EventState) {
        this._target?.onPointerDown(this._src, v.x, v.y, v.buttonIndex);
    }
    protected _onPointerUp(v: ICartesian2WithInfos, e: EventState) {
        this._target?.onPointerUp(this._src, v.x, v.y, v.buttonIndex);
    }
    protected _onWheel(v: number, e: EventState) {
        this._target?.onWheel(this._src, v);
    }
}
