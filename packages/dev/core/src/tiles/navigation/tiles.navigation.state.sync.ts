import { EventState, Observer, PropertyChangedEventArgs } from "../../events";
import { IDisposable, Nullable } from "../../types";
import { ITileNavigationState } from "./tiles.navigation.interfaces";

/// Synchronizes the state of a target ITileNavigationState with a source ITileNavigationState.
export class TileNavigationStateSynchronizer implements IDisposable {
    _source: ITileNavigationState;
    _target: ITileNavigationState;
    _sourceChangedObserver: Nullable<Observer<ITileNavigationState>>;
    _propertyChangedObserver: Nullable<Observer<PropertyChangedEventArgs<ITileNavigationState, unknown>>>;
    _enabled: boolean;

    public constructor(source: ITileNavigationState, target: ITileNavigationState, enabled: boolean = true) {
        this._source = source;
        this._target = target;
        this._enabled = enabled;
        this._sourceChangedObserver = this._source.stateChangedObservable.add(this._onSourceValidation.bind(this));
        this._propertyChangedObserver = this._source.propertyChangedObservable.add(this._onSourcePropertyChanged.bind(this));
    }

    public dispose(): void {
        this._sourceChangedObserver?.disconnect();
        this._propertyChangedObserver?.disconnect();
    }

    public get source(): ITileNavigationState {
        return this._source;
    }

    public get target(): ITileNavigationState {
        return this._target;
    }

    public get enabled(): boolean {
        return this._enabled;
    }

    public set enabled(v: boolean) {
        this._enabled = v;
    }

    protected _onSourceValidation(state: ITileNavigationState, eventState: EventState): void {
        if (this._enabled) {
            this._target.validate();
        }
    }

    protected _onSourcePropertyChanged(property: PropertyChangedEventArgs<ITileNavigationState, unknown>, eventState: EventState): void {
        if (this._enabled && property.propertyName) {
            (<any>this._target)[property.propertyName] = property.newValue;
        }
    }
}
