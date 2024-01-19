import { EventState, Observer, PropertyChangedEventArgs } from "../../events";
import { IDisposable, Nullable } from "../../types";
import { ITileNavigationState } from "./tiles.navigation.interfaces";
export declare class TileNavigationStateSynchronizer implements IDisposable {
    _source: ITileNavigationState;
    _target: ITileNavigationState;
    _sourceChangedObserver: Nullable<Observer<ITileNavigationState>>;
    _propertyChangedObserver: Nullable<Observer<PropertyChangedEventArgs<ITileNavigationState, unknown>>>;
    _enabled: boolean;
    constructor(source: ITileNavigationState, target: ITileNavigationState, enabled?: boolean);
    dispose(): void;
    get source(): ITileNavigationState;
    get target(): ITileNavigationState;
    get enabled(): boolean;
    set enabled(v: boolean);
    protected _onSourceValidation(state: ITileNavigationState, eventState: EventState): void;
    protected _onSourcePropertyChanged(property: PropertyChangedEventArgs<ITileNavigationState, unknown>, eventState: EventState): void;
}
