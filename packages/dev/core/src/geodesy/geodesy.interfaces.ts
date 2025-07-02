import { IGeo2 } from "../geography";

export interface IGeoProcessor {
    getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number, deg?: boolean): number;
    getAzimuthFromFloat(lata: number, lona: number, latb: number, lonb: number, deg?: boolean): number;
    getLocationAtDistanceAzimuth(lat: number, lon: number, distance: number, azimuth: number, deg?: boolean): IGeo2;
}
