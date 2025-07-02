import { IGeo2 } from "../geography/geography.interfaces";
import { Nullable } from "../types";
import { Ellipsoid } from "./geodesy.ellipsoid";
import { IGeoProcessor } from "./geodesy.interfaces";

export abstract class CalculatorBase implements IGeoProcessor {
    public static readonly Shared: Nullable<IGeoProcessor> = null;

    _ellipsoid: Ellipsoid;

    public constructor(e?: Ellipsoid) {
        this._ellipsoid = e ?? Ellipsoid.WGS84;
    }

    public get ellipsoid(): Ellipsoid {
        return this._ellipsoid;
    }
    abstract getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number, deg?: boolean): number;
    abstract getAzimuthFromFloat(lata: number, lona: number, latb: number, lonb: number, deg?: boolean): number;
    abstract getLocationAtDistanceAzimuth(lat: number, lon: number, distance: number, azimuth: number, deg?: boolean): IGeo2;
}
