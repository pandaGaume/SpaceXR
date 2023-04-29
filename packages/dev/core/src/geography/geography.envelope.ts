/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Scalar } from "../math/math";
import { IEnvelope, IGeo3, ISize3, isLocation } from "./geography.interfaces";
import { Geo3 } from "./geography.position";
import { Size3 } from "./geography.size";

export class Envelope implements IEnvelope {
    public static MaxLongitude = 540;
    public static MaxLatitude = 90;
    public static MinLongitude = -Envelope.MaxLongitude;
    public static MinLatitude = -Envelope.MaxLatitude;

    public static FromSize(position: IGeo3, size: ISize3) {
        const hasAlt = position.alt !== undefined && size.thickness !== undefined;

        const lat0 = Scalar.Clamp(position.lat, Envelope.MinLatitude, Envelope.MaxLatitude);
        const lon0 = Scalar.Clamp(position.lon, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt0 = hasAlt ? position.alt : undefined;

        const h = size.width % 180;
        const lat1 = Scalar.Clamp(position.lat + h, Envelope.MinLatitude, Envelope.MaxLatitude);
        const w = size.width % 360;
        const lon1 = Scalar.Clamp(position.lon + w, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt1 = hasAlt ? position.alt! + size.thickness! : undefined;

        const lower = new Geo3(Math.min(lat0, lat1), Math.min(lon0, lon1), hasAlt ? Math.min(alt0!, alt1!) : undefined);
        const upper = new Geo3(Math.max(lat0, lat1), Math.max(lon0, lon1), hasAlt ? Math.max(alt0!, alt1!) : undefined);

        return new Envelope(lower, upper);
    }

    public static FromPoints(a: IGeo3, b: IGeo3) {
        const hasAlt = a.alt !== undefined && b.alt !== undefined;

        const lat0 = Scalar.Clamp(a.lat, Envelope.MinLatitude, Envelope.MaxLatitude);
        const lon0 = Scalar.Clamp(a.lon, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt0 = hasAlt ? a.alt : undefined;

        const lat1 = Scalar.Clamp(b.lat, Envelope.MinLatitude, Envelope.MaxLatitude);
        const lon1 = Scalar.Clamp(b.lon, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt1 = hasAlt ? b.alt : undefined;

        const lower = new Geo3(Math.min(lat0, lat1), Math.min(lon0, lon1), hasAlt ? Math.min(alt0!, alt1!) : undefined);
        const upper = new Geo3(Math.max(lat0, lat1), Math.max(lon0, lon1), hasAlt ? Math.max(alt0!, alt1!) : undefined);

        return new Envelope(lower, upper);
    }

    _min: IGeo3;
    _max: IGeo3;

    private constructor(lowerCorner: IGeo3, upperCorner: IGeo3) {
        this._min = lowerCorner;
        this._max = upperCorner;
    }

    public get north(): number {
        return this._max.lat;
    }

    public get south(): number {
        return this._min.lat;
    }

    public get east(): number {
        return this._max.lon;
    }

    public get west(): number {
        return this._min.lon;
    }

    public get bottom(): number | undefined {
        return this._min.alt;
    }

    public get top(): number | undefined {
        return this._max.alt;
    }

    public get nw(): IGeo3 {
        return new Geo3(this.north, this.west);
    }

    public get sw(): IGeo3 {
        return new Geo3(this.south, this.west);
    }

    public get ne(): IGeo3 {
        return new Geo3(this.north, this.east);
    }

    public get se(): IGeo3 {
        return new Geo3(this.south, this.east);
    }

    public equals(other: IEnvelope): boolean {
        return (
            other &&
            this._min.lat === other.south &&
            this._min.lon === other.west &&
            this._min.alt === other.bottom &&
            this._max.lat === other.north &&
            this._max.lon === other.east &&
            this._max.alt === other.top
        );
    }

    public clone(): IEnvelope {
        return new Envelope(this._min.clone(), this._max.clone());
    }

    public get hasAltitude(): boolean {
        return this._min.hasAltitude && this._max.hasAltitude;
    }

    public get center(): IGeo3 {
        const lat = this._min.lon + (this._max.lon - this._min.lon) / 2;
        const lon = this._min.lat + (this._max.lat - this._min.lat) / 2;
        const alt = this.hasAltitude ? this._min.alt! + (this._max.alt! - this._min.alt!) / 2 : undefined;
        return new Geo3(lat, lon, alt);
    }

    public get size(): ISize3 {
        const w = this._max.lon - this._min.lon;
        const h = this._max.lat - this._min.lat;
        const t = this.hasAltitude ? this._max.alt! - this._min.alt! : undefined;

        return new Size3(h, w, t);
    }

    public add(lat: number | IGeo3, lon?: number, alt?: number): IEnvelope {
        return this.clone().addInPlace(lat, lon, alt);
    }

    public addInPlace(lat: number | IGeo3, lon?: number, alt?: number): IEnvelope {
        if (isLocation(lat)) {
            return this.addInPlace(lat.lat, lat.lon, lat.alt);
        }

        this._min.lat = Math.min(this._min.lat, lat);
        this._max.lat = Math.max(this._max.lat, lat);
        if (lon) {
            this._min.lon = Math.min(this._min.lon, lon);
            this._max.lon = Math.max(this._max.lon, lon);
        }
        if (this.hasAltitude && alt) {
            this._min.alt = Math.min(this._min.alt!, alt);
            this._max.alt = Math.max(this._max.alt!, alt);
        }
        return this;
    }

    public intersectWith(bounds: IEnvelope): boolean {
        if (this._min.lat > bounds.north || this._max.lat < bounds.south || this._min.lon > bounds.east || this._max.lon < bounds.west) {
            return false;
        }

        if (this.hasAltitude && bounds.hasAltitude) {
            if (this._min.alt! > bounds.top! || this._max.alt! < bounds.bottom!) {
                return false;
            }
        }

        return true;
    }

    public contains(loc: IGeo3): boolean {
        return this.containsFloat(loc.lat, loc.lon, loc.alt);
    }

    public containsFloat(lat: number, lon?: number, alt?: number): boolean {
        return (
            lat >= this._min.lat &&
            lat <= this._max.lat &&
            (lon === undefined || (lon >= this._min.lon && lon <= this._max.lon)) &&
            (alt === undefined || (this.hasAltitude && alt >= this._min.alt! && alt <= this._max.alt!))
        );
    }
}
