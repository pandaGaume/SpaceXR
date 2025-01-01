import { Observable, PropertyChangedEventArgs } from "../../events";
import { ICartesian3 } from "../../geometry";
import { ICameraState } from "./tiles.navigation.interfaces";

export class CameraState implements ICameraState {
    public static readonly POSITION_PROPERTY_NAME: string = "position";
    public static readonly TARGET_PROPERTY_NAME: string = "target";
    public static readonly FOV_PROPERTY_NAME: string = "fov";

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ICameraState, unknown>>;

    private _position: ICartesian3;
    private _target: ICartesian3;
    private _fov: number;

    constructor(position: ICartesian3, target: ICartesian3, fov: number) {
        this._position = position;
        this._target = target;
        this._fov = fov;
    }

    /// <summary>
    /// An observable that notifies subscribers of changes to properties in the state.
    /// </summary>
    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ICameraState, unknown>> {
        if (!this._propertyChangedObservable) this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ICameraState, unknown>>();
        return this._propertyChangedObservable;
    }
    /// <summary>
    /// Gets or sets the position of the camera. When set, notifies observers of the change.
    /// </summary>
    get position(): ICartesian3 {
        return this._position;
    }

    set position(value: ICartesian3) {
        if (this._position !== value) {
            const old = this._position;
            this._position = value;
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._position, CameraState.POSITION_PROPERTY_NAME);
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }

    /// <summary>
    /// Gets or sets the target of the camera. When set, notifies observers of the change.
    /// </summary>
    get target(): ICartesian3 {
        return this._target;
    }

    set target(value: ICartesian3) {
        if (this._target !== value) {
            const old = this._target;
            this._target = value;
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._target, CameraState.TARGET_PROPERTY_NAME);
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }

    /// <summary>
    /// Gets or sets the field of view (FOV) of the camera. When set, notifies observers of the change.
    /// </summary>
    get fov(): number {
        return this._fov;
    }

    set fov(value: number) {
        if (this._fov !== value) {
            const old = this._fov;
            this._fov = value;
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._fov, CameraState.TARGET_PROPERTY_NAME);
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }
}
