import { IGeo3 } from "./geography.interfaces";
export declare class Geo3 implements IGeo3 {
    static Zero(): Geo3;
    private _lat;
    private _lon;
    private _alt?;
    constructor(lat: number, lon: number, alt?: number);
    get lat(): number;
    get lon(): number;
    get alt(): number | undefined;
    get hasAltitude(): boolean;
    clone(): IGeo3;
    equals(other: IGeo3): boolean;
}
