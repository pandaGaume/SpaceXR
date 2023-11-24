import { IGeo2 } from "../geography/geography.interfaces";
export interface IDistanceProcessor {
    getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number): number;
    getAzimuthFromFloat(lata: number, lona: number, latb: number, lonb: number): number;
    getLocationAtDistanceAzimuth(lat: number, lon: number, distance: number, azimuth: number): IGeo2;
}
