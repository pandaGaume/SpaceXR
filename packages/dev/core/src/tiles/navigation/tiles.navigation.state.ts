import { IGeo2 } from "../../geography/geography.interfaces";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { Observable } from "../../events/events.observable";
import { ITileNavigationState } from "./tiles.navigation.interfaces";
import { Geo2 } from "../../geography/geography.position";

export class TileNavigationState implements ITileNavigationState {
    _centerObservable?: Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>>;
    _zoomObservable?: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    _azimuthObservable?: Observable<PropertyChangedEventArgs<ITileNavigationState, number>>;
    _stateChangedObservable?: Observable<ITileNavigationState>;

    _valid: boolean;
    _lodf: number;
    _center: IGeo2;
    _azimuth: number;

    public constructor(center?: IGeo2, lod?: number, azimuth?: number) {
        this._lodf = 0;
        this._center = Geo2.Zero();
        this._azimuth = 0;
        this._valid = false;
    }

    public get center(): IGeo2 {
        return this._center;
    }

    public set center(center: IGeo2) {
        if (center && !this._center.equals(center)) {
            if (this._centerObservable && this._centerObservable.hasObservers()) {
                const old = this._center.clone();
                this._center.lat = center.lat;
                this._center.lon = center.lon;
                const e = new PropertyChangedEventArgs(this, old, center);
                this._centerObservable.notifyObservers(e);
                this.invalidate();
                return;
            }
            this._center.lat = center.lat;
            this._center.lon = center.lon;
            this.invalidate();
        }
    }

    public get zoom(): number {
        return this._lodf;
    }

    public set zoom(lodf: number) {
        if (this._lodf != lodf) {
            const old = this._lodf;
            this._lodf = lodf;
            if (this._zoomObservable && this._zoomObservable.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, lodf);
                this._zoomObservable.notifyObservers(e);
            }
            this.invalidate();
        }
    }

    public get azimuth(): number {
        return this._azimuth;
    }

    public set azimuth(r: number) {
        if (this._azimuth != r) {
            const old = this._azimuth;
            this._azimuth = r;
            if (this._azimuthObservable && this._azimuthObservable.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, r);
                this._azimuthObservable.notifyObservers(e);
            }
            this.invalidate();
        }
    }

    /// VALIDABLE
    public get isValid(): boolean {
        return this._valid;
    }

    public invalidate(): ITileNavigationState {
        this._valid = false;
        return this;
    }

    public validate(): ITileNavigationState {
        if (!this._valid) {
            this._doValidateInternal();
            this._valid = true;
        }
        return this;
    }

    public revalidate(): ITileNavigationState {
        return this.invalidate().validate();
    }

    public get centerObservable(): Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>> {
        this._centerObservable = this._centerObservable || new Observable<PropertyChangedEventArgs<ITileNavigationState, IGeo2>>();
        return this._centerObservable;
    }

    public get zoomObservable(): Observable<PropertyChangedEventArgs<ITileNavigationState, number>> {
        this._zoomObservable = this._zoomObservable || new Observable<PropertyChangedEventArgs<ITileNavigationState, number>>();
        return this._zoomObservable;
    }

    public get azimuthObservable(): Observable<PropertyChangedEventArgs<ITileNavigationState, number>> {
        this._azimuthObservable = this._azimuthObservable || new Observable<PropertyChangedEventArgs<ITileNavigationState, number>>();
        return this._azimuthObservable;
    }

    public get stateChangedObservable(): Observable<ITileNavigationState> {
        this._stateChangedObservable = this._stateChangedObservable || new Observable<ITileNavigationState>();
        return this._stateChangedObservable;
    }

    protected _doValidateInternal() {
        this._beforeValidate();
        this._doValidate();
        // dispatch event
        if (this._stateChangedObservable && this._stateChangedObservable.hasObservers()) {
            this._stateChangedObservable.notifyObservers(this);
        }
        this._afterValidate();
    }

    protected _beforeValidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _doValidate() {
        /* nothing to do here, may be override by subclass */
    }
    protected _afterValidate() {
        /* nothing to do here, may be override by subclass */
    }
}
