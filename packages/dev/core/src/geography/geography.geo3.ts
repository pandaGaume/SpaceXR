import { IGeo3 } from "./geography.interfaces";
import { AbstractRange } from "../math/math";

export class Geo3 implements IGeo3 {
    public static Zero() {
        return new Geo3(0, 0, 0);
    }

    private _lat: number;
    private _lon: number;
    private _alt?: number;

    public constructor(lat: number, lon: number, alt?: number) {
        this._lat = lat;
        this._lon = lon;
        this._alt = alt;
    }

    public get lat(): number {
        return this._lat;
    }

    public get lon(): number {
        return this._lon;
    }

    public get alt(): number | undefined {
        return this._alt;
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

export class GeodeticRange extends AbstractRange<IGeo3> {
    protected computeDelta(a: IGeo3, b?: IGeo3): IGeo3 {
        if (a && b) {
            const w = a.lon - b.lon;
            const h = a.lat - b.lat;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const t = a.hasAltitude && b.hasAltitude ? b.alt! - a.alt! : undefined;

            return new Geo3(h, w, t);
        }
        return new Geo3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    }
}
