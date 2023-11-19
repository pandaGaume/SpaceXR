import { Ellipsoid } from "./geodesy.ellipsoid";
import { IDistanceProcessor } from "./geodesy.interfaces";
export declare class CalculatorBase {
    _ellipsoid: Ellipsoid;
    constructor(e?: Ellipsoid);
    get ellipsoid(): Ellipsoid;
}
export declare class HaversineCalculator extends CalculatorBase implements IDistanceProcessor {
    static readonly Shared: HaversineCalculator;
    constructor(e?: Ellipsoid);
    getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number): number;
}
export declare class PythagoreanFlatEarthCalculator extends CalculatorBase implements IDistanceProcessor {
    static readonly Shared: PythagoreanFlatEarthCalculator;
    constructor(e?: Ellipsoid);
    getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number): number;
}
