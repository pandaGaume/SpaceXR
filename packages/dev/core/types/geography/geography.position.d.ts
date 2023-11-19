import { IGeo2, IGeo3 } from "./geography.interfaces";
import { Range } from "../math/math";
export declare class Geo2 implements IGeo2 {
    static Default: Geo2;
    static LatRange: Range;
    static LonRange: Range;
    static Zero(): Geo2;
    protected _lat: number;
    protected _lon: number;
    constructor(lat: number, lon: number);
    get lat(): number;
    get lon(): number;
    set lat(v: number);
    set lon(v: number);
    clone(): IGeo2;
    equals(other: IGeo2): boolean;
}
export declare class Geo3 extends Geo2 implements IGeo3 {
    static Zero(): Geo3;
    protected _alt?: number;
    constructor(lat: number, lon: number, alt?: number);
    get alt(): number | undefined;
    set alt(v: number | undefined);
    get hasAltitude(): boolean;
    clone(): IGeo3;
    equals(other: IGeo3): boolean;
}
