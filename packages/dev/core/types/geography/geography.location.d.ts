import { ILocation } from "./geography.interfaces";
import { AbstractRange } from "../math/math";
export declare class Location implements ILocation {
    static Zero(): Location;
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
export declare class GeodeticRange extends AbstractRange<ILocation> {
    protected computeDelta(a: ILocation, b?: ILocation): ILocation;
}
