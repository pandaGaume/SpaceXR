import { IGeo2, IGeo3 } from "./geography.interfaces";
import { Range } from "../math/math";

export class Geo2 implements IGeo2 {
    public static Default = new Geo2(46.382581, -0.308024);

    public static LatRange: Range = new Range(-90, 90);
    public static LonRange: Range = new Range(-180, 180);

    public static Zero() {
        return new Geo2(0, 0);
    }

    protected _lat: number;
    protected _lon: number;

    public constructor(lat: number, lon: number) {
        this._lat = lat;
        this._lon = lon;
    }

    public get lat(): number {
        return this._lat;
    }

    public get lon(): number {
        return this._lon;
    }
    public set lat(v: number) {
        this._lat = v;
    }

    public set lon(v: number) {
        this._lon = v;
    }

    public clone(): IGeo2 {
        return new Geo2(this._lat, this._lon);
    }

    public equals(other: IGeo2): boolean {
        return this._lat === other.lat && this._lon === other.lon;
    }
}

export class Geo3 extends Geo2 implements IGeo3 {
    public static Zero() {
        return new Geo3(0, 0, 0);
    }

    protected _alt?: number;

    public constructor(lat: number, lon: number, alt?: number) {
        super(lat, lon);
        this._alt = alt;
    }

    public get alt(): number | undefined {
        return this._alt;
    }
    public set alt(v: number | undefined) {
        this._alt = v;
    }

    public get hasAltitude(): boolean {
        return this._alt !== undefined;
    }

    public clone(): IGeo3 {
        return new Geo3(this._lat, this._lon, this._alt);
    }

    public equals(other: IGeo3): boolean {
        return this._lat === other.lat && this._lon === other.lon && this._alt === other.alt;
    }
}
