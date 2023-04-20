import { ILocation } from "./geography.interfaces";
export declare class Location implements ILocation {
    private _lat;
    private _lon;
    private _alt?;
    constructor(lat: number, lon: number, alt?: number);
    get lat(): number;
    get lon(): number;
    get alt(): number | undefined;
    get hasAltitude(): boolean;
    clone(): ILocation;
    equals(other: ILocation): boolean;
}
