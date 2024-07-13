import { IGeo2, IGeo3 } from "./geography.interfaces";
import { GeoJsonCoordinate } from "./standards/geojson/geojson.interface";
export declare class Geo2 implements IGeo2 {
    static Default: Geo2;
    static FromGeoJson(coordinates: GeoJsonCoordinate): IGeo2;
    static Parse(value: string): IGeo2;
    static ToString(value: IGeo2): string;
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
    toString(): string;
}
export declare class Geo3 extends Geo2 implements IGeo3 {
    static FromGeoJson(coordinates: GeoJsonCoordinate): IGeo3;
    static ToString(value: IGeo3): string;
    static Parse(value: string): IGeo3;
    static Zero(): Geo3;
    protected _alt?: number;
    constructor(lat: number, lon: number, alt?: number);
    get alt(): number | undefined;
    set alt(v: number | undefined);
    get hasAltitude(): boolean;
    clone(): IGeo3;
    equals(other: IGeo3): boolean;
    toString(): string;
}
