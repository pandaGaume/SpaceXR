import { IDisposable, Nullable } from "../../types";
import { Cartesian2, ICartesian2 } from "../../geometry";
import { InputsNavigationTarget } from "./map.inputs.navigation";
import { ICartesian2WithInfos, IPointerSource } from "./map.inputs.interfaces";
import { EventState, Observer } from "../../events";
export declare class Cartesian2WithInfos extends Cartesian2 implements ICartesian2WithInfos {
    x: number;
    y: number;
    _buttonIndex: number;
    constructor(x: number, y: number, buttonIndex?: number);
    get buttonIndex(): number;
}
export declare class PointerController<S extends IPointerSource> implements IDisposable {
    _src: S;
    _target: InputsNavigationTarget<S>;
    _moveObserver?: Nullable<Observer<ICartesian2>>;
    _downObserver?: Nullable<Observer<ICartesian2WithInfos>>;
    _upObserver?: Nullable<Observer<ICartesian2WithInfos>>;
    _wheelObserver?: Nullable<Observer<number>>;
    constructor(src: S, target: InputsNavigationTarget<S>);
    dispose(): void;
    protected _attachControl(src: S): void;
    protected _detachControl(src: S): void;
    protected _onPointerMove(v: ICartesian2, e: EventState): void;
    protected _onPointerDown(v: ICartesian2WithInfos, e: EventState): void;
    protected _onPointerUp(v: ICartesian2WithInfos, e: EventState): void;
    protected _onWheel(v: number, e: EventState): void;
}
