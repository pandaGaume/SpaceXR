export interface IDistanceProcessor {
    getDistanceFromFloat(lata: number, lona: number, latb: number, lonb: number, alta?: number, altb?: number): number;
}
