import { EventState, Observer } from "../../events";
import { ITileNavigationApi } from "../../tiles";
import { IDisposable, Nullable } from "../../types";
import { ICartesian2WithInfos, IPointerSource, IWheelSource } from "./map.inputs.interfaces";
import { InputsNavigationTarget } from "./map.inputs.navigation";
export declare class PointerController<S extends IPointerSource & IWheelSource> implements IDisposable {
    _src: S;
    _target: InputsNavigationTarget<S>;
    _moveObserver?: Nullable<Observer<ICartesian2WithInfos>>;
    _downObserver?: Nullable<Observer<ICartesian2WithInfos>>;
    _upObserver?: Nullable<Observer<ICartesian2WithInfos>>;
    _wheelObserver?: Nullable<Observer<number>>;
    constructor(src: S, target: InputsNavigationTarget<S> | ITileNavigationApi);
    dispose(): void;
    protected _attachControl(src: S): void;
    protected _detachControl(src: S): void;
    protected _onPointerMove(v: ICartesian2WithInfos, e: EventState): void;
    protected _onPointerDown(v: ICartesian2WithInfos, e: EventState): void;
    protected _onPointerUp(v: ICartesian2WithInfos, e: EventState): void;
    protected _onWheel(v: number, e: EventState): void;
}
