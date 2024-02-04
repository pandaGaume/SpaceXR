import { IGeo2 } from "../geography";
export interface IGeoCalculator {
    getDistanceBetweenTwoPoint(a: IGeo2, b: IGeo2, deg?: boolean): number;
    getDistanceBetweenTwoPoint_Haversine(a: IGeo2, b: IGeo2, deg?: boolean): number;
    getLocationAtDistanceAzimuthToRef(a: IGeo2, dist: number, az: number, ref: IGeo2, deg?: boolean): void;
    getCrossTrackDistance(a: IGeo2, b: IGeo2, c: IGeo2, deg?: boolean): number;
    getCrossArcDistance(a: IGeo2, b: IGeo2, c: IGeo2, deg?: boolean): number;
    getBearing(a: IGeo2, b: IGeo2, deg?: boolean): number;
}
