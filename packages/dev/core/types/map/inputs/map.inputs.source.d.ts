import { IDisposable, Nullable } from "../../types";
import { ICartesian4 } from "../../geometry";
import { InputsNavigationTarget } from "./map.inputs.navigation";
import { IPointerSource } from "./map.inputs.interfaces";
import { EventState, Observer } from "../../events";
export declare class PointerController<T extends IPointerSource<T>> implements IDisposable {
    _src: T;
    _target: InputsNavigationTarget<T>;
    _moveObserver?: Nullable<Observer<ICartesian4>>;
    _downObserver?: Nullable<Observer<ICartesian4>>;
    _upObserver?: Nullable<Observer<ICartesian4>>;
    _wheelObserver?: Nullable<Observer<ICartesian4>>;
    constructor(src: T, target: InputsNavigationTarget<T>);
    dispose(): void;
    protected _attachControl(src: T): void;
    protected _detachControl(src: T): void;
    protected _onPointerMove(v: ICartesian4, e: EventState): void;
    protected _onPointerDown(v: ICartesian4, e: EventState): void;
    protected _onPointerUp(v: ICartesian4, e: EventState): void;
    protected _onWheel(v: ICartesian4, e: EventState): void;
}
