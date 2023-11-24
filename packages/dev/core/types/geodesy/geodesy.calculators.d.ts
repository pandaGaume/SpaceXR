import { IGeo2 } from "../geography/geography.interfaces";
import { Ellipsoid } from "./geodesy.ellipsoid";
import { IDistanceProcessor } from "./geodesy.interfaces";
export declare abstract class CalculatorBase implements IDistanceProcessor {
    _ellipsoid: Ellipsoid;
    constructor(e?: Ellipsoid);
    get ellipsoid(): Ellipsoid;
    abstract getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number): number;
    abstract getAzimuthFromFloat(lata: number, lona: number, latb: number, lonb: number): number;
    abstract getLocationAtDistanceAzimuth(lat: number, lon: number, distance: number, azimuth: number): IGeo2;
}
export declare class HaversineCalculator extends CalculatorBase implements IDistanceProcessor {
    static readonly Shared: HaversineCalculator;
    constructor(e?: Ellipsoid);
    getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number): number;
    getAzimuthFromFloat(lat1: number, lon1: number, lat2: number, lon2: number): number;
    getLocationAtDistanceAzimuth(lat: number, lon: number, dist: number, az: number): IGeo2;
}
export declare class PythagoreanFlatEarthCalculator extends CalculatorBase implements IDistanceProcessor {
    static readonly Shared: PythagoreanFlatEarthCalculator;
    constructor(e?: Ellipsoid);
    getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number): number;
    getAzimuthFromFloat(lat1: number, lon1: number, lat2: number, lon2: number): number;
    getLocationAtDistanceAzimuth(lat1: number, lon1: number, dist: number, az: number): IGeo2;
}
