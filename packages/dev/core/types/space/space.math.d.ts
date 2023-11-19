export declare class CelestialCoordinates {
    static GetJulianDate(date: Date): number;
    static GetSolarDeclination(julianDate: number): number;
    static GetSolarAzimuth(declination: number, latitude: number, longitude: number, currentTime: Date): number;
}
