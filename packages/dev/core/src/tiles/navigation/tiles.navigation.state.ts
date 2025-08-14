import { PropertyChangedEventArgs, Observable, Observer, EventState } from "../../events";
import { ICameraViewState, ITileNavigationState } from "./tiles.navigation.interfaces";
import { Nullable } from "../../types";
import { ValidableBase } from "../../validable";
import { ITileSystemBounds } from "../tiles.interfaces";
import { ICartesian2, Cartesian2 } from "../../geometry";
import { IGeo2, IsLocation, Bearing, Geo2 } from "../../geography";
import { TileSystemBounds } from "../tiles.system";
import { TileNavigationStateSynchronizer } from "./tiles.navigation.state.sync";

export class TileNavigationState extends ValidableBase implements ITileNavigationState {
    public static readonly CENTER_PROPERTY_NAME: string = "center";
    public static readonly ZOOM_PROPERTY_NAME: string = "zoom";
    public static readonly LOD_PROPERTY_NAME: string = "lod";
    public static readonly AZIMUTH_PROPERTY_NAME: string = "azimuth";
    public static readonly BOUNDS_PROPERTY_NAME: string = "bounds";
    public static readonly CAMERA_PROPERTY_NAME: string = "camera";

    public static GetLodScale(lod: number): number {
        let lodOffset = (lod * 1000 - Math.round(lod) * 1000) / 1000; // Trick to avoid floating point error.
        // scale corresponding to the decimal part
        let scale = lodOffset < 0 ? 1 + lodOffset / 2 : 1 + lodOffset;
        return scale;
    }

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>;

    _lodf: number;
    _center: IGeo2;
    _azimuth: Bearing;
    _bounds: ITileSystemBounds;

    // internal
    _cartesianCache: ICartesian2 = Cartesian2.Zero();
    _lod: number;
    _scale: number;
    _camera?: ICameraViewState;
    _boundsObserver?: Nullable<Observer<PropertyChangedEventArgs<ITileSystemBounds, unknown>>>;
    _sync: Nullable<TileNavigationStateSynchronizer>;

    public constructor(center?: IGeo2 | Array<number>, lod?: number, azimuth?: number, bounds?: ITileSystemBounds) {
        super();
        this._lodf = lod ?? 0;
        this._center = center ? (IsLocation(center) ? new Geo2(center?.lat ?? 0, center?.lon ?? 0) : new Geo2(center[0] ?? 0, center[1] ?? 0)) : Geo2.Zero();
        this._azimuth = new Bearing(azimuth ?? 0);
        this._bounds = bounds ?? new TileSystemBounds();
        this._boundsObserver = this._bounds.propertyChangedObservable.add(this._boundsPropertyChanged.bind(this));
        this._lod = Math.round(this._lodf);
        this._scale = TileNavigationState.GetLodScale(this._lodf);
        this._sync = null;
    }

    public clone(): ITileNavigationState {
        return <any>new TileNavigationState(this._center, this._lod, this._azimuth.value, this._bounds);
    }

    public dispose() {
        this._boundsObserver?.disconnect;
        this._boundsObserver = null;
        if (this._sync) {
            this._sync.dispose();
            this._sync = null;
        }
    }

    public get lod(): number {
        return this._lod;
    }

    public get scale(): number {
        return this._scale;
    }

    public get center(): IGeo2 {
        return this._center;
    }

    public set center(center: IGeo2) {
        center = center ?? Geo2.Zero();
        const lat = Math.min(Math.max(center.lat, this._bounds.minLatitude), this._bounds.maxLatitude);
        const lon = Math.min(Math.max(center.lon, this._bounds.minLongitude), this._bounds.maxLongitude);
        if (this._center.lat != lat || this._center.lon != lon) {
            if (this._propertyChangedObservable?.hasObservers()) {
                const old = this._center.clone();
                this._center.lat = lat;
                this._center.lon = lon;
                const e = new PropertyChangedEventArgs(this, old, this._center.clone(), TileNavigationState.CENTER_PROPERTY_NAME);
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
                this.invalidate();
                return;
            }
            this._center.lat = lat;
            this._center.lon = lon;
            this.invalidate();
        }
    }

    public get zoom(): number {
        return this._lodf;
    }

    public set zoom(lodf: number) {
        lodf = Math.min(Math.max(lodf, this._bounds.minLOD), this._bounds.maxLOD);
        if (this._lodf != lodf) {
            const old = this._lodf;
            this._lodf = lodf;
            const lod = Math.round(this._lodf);
            let event: Nullable<PropertyChangedEventArgs<ITileNavigationState, unknown>> = null;
            if (this._lod != lod) {
                const oldLod = this._lod;
                this._lod = lod;
                if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                    event = new PropertyChangedEventArgs(this, oldLod, this._lod, TileNavigationState.LOD_PROPERTY_NAME);
                }
            }

            this._scale = TileNavigationState.GetLodScale(this._lodf);
            this.invalidate();

            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                if (event) {
                    this._propertyChangedObservable.notifyObservers(event, -1, this, this);
                }
                event = new PropertyChangedEventArgs(this, old, this._lodf, TileNavigationState.ZOOM_PROPERTY_NAME);
                this._propertyChangedObservable.notifyObservers(event, -1, this, this);
            }
        }
    }

    public get azimuth(): Bearing {
        return this._azimuth;
    }

    public set azimuth(r: Bearing) {
        if (this._azimuth.value != r.value) {
            const old = this._azimuth;
            this._azimuth = r;
            this.invalidate();
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._azimuth, TileNavigationState.AZIMUTH_PROPERTY_NAME);
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }

    public get camera(): ICameraViewState | undefined {
        return this._camera;
    }

    public set camera(c: ICameraViewState) {
        if (this._camera !== c) {
            const old = this._camera;
            this._camera = c;
            this.invalidate();
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._camera, TileNavigationState.CAMERA_PROPERTY_NAME);
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }

    public get bounds(): ITileSystemBounds {
        return this._bounds;
    }

    public set bounds(bounds: ITileSystemBounds) {
        if (this._bounds !== bounds) {
            this._boundsObserver?.disconnect;
            const old = this._bounds;
            this._bounds = bounds;
            this._boundsObserver = this._bounds.propertyChangedObservable.add(this._boundsPropertyChanged.bind(this));
            this.invalidate();
            if (this._propertyChangedObservable?.hasObservers()) {
                const e = new PropertyChangedEventArgs(this, old, this._bounds, TileNavigationState.BOUNDS_PROPERTY_NAME);
                this._propertyChangedObservable.notifyObservers(e, -1, this, this);
            }
        }
    }

    /// <summary>
    /// An observable that notifies subscribers of changes to properties in the state.
    /// </summary>
    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>> {
        if (!this._propertyChangedObservable) this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileNavigationState, unknown>>();
        return this._propertyChangedObservable;
    }

    public copy(other: ITileNavigationState): TileNavigationState {
        this.center = other.center;
        this.azimuth = new Bearing(other.azimuth.value);
        this.zoom = other.zoom;
        return this;
    }

    public syncWith(state: Nullable<ITileNavigationState>): TileNavigationState {
        if (this._sync) {
            this._sync.dispose();
            this._sync = null;
        }
        if (state) {
            this.copy(state).validate();
            this._sync = new TileNavigationStateSynchronizer(state, this);
        }
        return this;
    }

    public toString(): string {
        return `center: ${this.center}, zoom: ${this.zoom}, azimuth: ${this.azimuth}`;
    }

    protected _boundsPropertyChanged(e: PropertyChangedEventArgs<unknown, unknown>, state: EventState) {}
}
