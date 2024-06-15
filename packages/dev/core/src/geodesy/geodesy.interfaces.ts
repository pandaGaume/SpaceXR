import { IGeo2 } from "../geography";

export interface IGeoProcessor {
    getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number): number;
    getAzimuthFromFloat(lata: number, lona: number, latb: number, lonb: number): number;
    getLocationAtDistanceAzimuth(lat: number, lon: number, distance: number, azimuth: number): IGeo2;
}
