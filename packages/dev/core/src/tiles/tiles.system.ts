import { Projections } from "../geography";
import { ITileSystemBounds } from "./tiles.interfaces";
import { Observable, PropertyChangedEventArgs } from "../events";
import { Nullable } from "../types";

export class TileSystemBounds implements ITileSystemBounds {
    public static Intersection(bounds: Array<ITileSystemBounds>): Nullable<ITileSystemBounds> {
        if (!bounds || bounds.length === 0) {
            return null;
        }
        const result = bounds[0].clone();
        for (let i = 1; i < bounds.length; i++) {
            result.intersectionInPlace(bounds[i]);
        }
        return result;
    }

    public static Union(bounds: Array<ITileSystemBounds>): Nullable<ITileSystemBounds> {
        if (!bounds || bounds.length === 0) {
            return null;
        }
        const result = bounds[0].clone();
        for (let i = 1; i < bounds.length; i++) {
            result.unionInPlace(bounds[i]);
        }
        return result;
    }

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
            Object.assign(this, p);
        }
    }

    public get propertyChangedObservable(): Observable<PropertyChangedEventArgs<ITileSystemBounds, unknown>> {
        if (!this._propertyChangedObservable) {
            this._propertyChangedObservable = new Observable<PropertyChangedEventArgs<ITileSystemBounds, unknown>>();
        }
        return this._propertyChangedObservable;
    }

    public unionInPlace(bounds: ITileSystemBounds): void {
        if (bounds) {
            this.minLOD = Math.min(this.minLOD, bounds.minLOD);
            this.maxLOD = Math.max(this.maxLOD, bounds.maxLOD);
            this.minLatitude = Math.min(this.minLatitude, bounds.minLatitude);
            this.maxLatitude = Math.max(this.maxLatitude, bounds.maxLatitude);
            this.minLongitude = Math.min(this.minLongitude, bounds.minLongitude);
            this.maxLongitude = Math.max(this.maxLongitude, bounds.maxLongitude);
        }
    }

    public copy(bounds: ITileSystemBounds): void {
        if (bounds) {
            this.minLOD = bounds.minLOD;
            this.maxLOD = bounds.maxLOD;
            this.minLatitude = bounds.minLatitude;
            this.maxLatitude = bounds.maxLatitude;
            this.minLongitude = bounds.minLongitude;
            this.maxLongitude = bounds.maxLongitude;
        }
    }

    public clone(): ITileSystemBounds {
        return new TileSystemBounds(this);
    }

    public intersectionInPlace(bounds: ITileSystemBounds): void {
        if (bounds) {
            this.minLOD = Math.max(this.minLOD, bounds.minLOD);
            this.maxLOD = Math.min(this.maxLOD, bounds.maxLOD);
            this.minLatitude = Math.max(this.minLatitude, bounds.minLatitude);
            this.maxLatitude = Math.min(this.maxLatitude, bounds.maxLatitude);
            this.minLongitude = Math.max(this.minLongitude, bounds.minLongitude);
            this.maxLongitude = Math.min(this.maxLongitude, bounds.maxLongitude);
        }
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
