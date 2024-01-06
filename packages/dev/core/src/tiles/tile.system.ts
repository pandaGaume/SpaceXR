import { Projections } from "../geography";
import { ITileSystemBounds } from "./tiles.interfaces";
import { Observable, PropertyChangedEventArgs } from "../events";

export class TileSystemBounds implements ITileSystemBounds {
    public static DefaultLOD = 0;
    public static DefaultMinLOD = 0;
    public static DefaultMaxLOD = 23;
    public static DefaultMinLatitude = Projections.WebMercatorMinLatitude;
    public static DefaultMaxLatitude = Projections.WebMercatorMaxLatitude;
    public static DefaultMinLongitude = -180;
    public static DefaultMaxLongitude = 180;

    public static Shared: TileSystemBounds = new TileSystemBounds();

    _minLOD: number = TileSystemBounds.DefaultMinLOD;
    _maxLOD: number = TileSystemBounds.DefaultMaxLOD;
    _minLatitude: number = TileSystemBounds.DefaultMinLatitude;
    _maxLatitude: number = TileSystemBounds.DefaultMaxLatitude;
    _minLongitude: number = TileSystemBounds.DefaultMinLongitude;
    _maxLongitude: number = TileSystemBounds.DefaultMaxLongitude;

    _propertyChangedObservable?: Observable<PropertyChangedEventArgs<ITileSystemBounds, unknown>>;

    public constructor(p?: Partial<ITileSystemBounds>) {
        if (p) {
            const definedProps = (Object.keys(p) as Array<keyof unknown>)
                .filter((key) => p[key] !== undefined)
                .reduce((obj: any, key) => {
                    obj[key] = p[key];
                    return obj;
                }, {});
            Object.assign(this, definedProps);
        }
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileSystemBounds, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileSystemBounds, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    public get minLOD(): number {
        return this._minLOD;
    }

    public set minLOD(v: number) {
        if (this._minLOD !== v) {
            const old = this._minLOD;
            this._minLOD = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "minLOD"), -1, this, this);
        }
    }

    public get maxLOD(): number {
        return this._maxLOD;
    }

    public set maxLOD(v: number) {
        if (this._maxLOD !== v) {
            const old = this._maxLOD;
            this._maxLOD = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "maxLOD"), -1, this, this);
        }
    }

    public get minLatitude(): number {
        return this._minLatitude;
    }

    public set minLatitude(v: number) {
        if (this._minLatitude !== v) {
            const old = this._minLatitude;
            this._minLatitude = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "minLatitude"), -1, this, this);
        }
    }

    public get maxLatitude(): number {
        return this._maxLatitude;
    }

    public set maxLatitude(v: number) {
        if (this._maxLatitude !== v) {
            const old = this._maxLatitude;
            this._maxLatitude = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "maxLatitude"), -1, this, this);
        }
    }

    public get minLongitude(): number {
        return this._minLongitude;
    }

    public set minLongitude(v: number) {
        if (this._minLongitude !== v) {
            const old = this._minLongitude;
            this._minLongitude = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "minLongitude"), -1, this, this);
        }
    }

    public get maxLongitude(): number {
        return this._maxLongitude;
    }

    public set maxLongitude(v: number) {
        if (this._maxLongitude !== v) {
            const old = this._maxLongitude;
            this._maxLongitude = v;
            this._propertyChangedObservable?.notifyObservers(new PropertyChangedEventArgs(this, old, v, "maxLongitude"), -1, this, this);
        }
    }
}
