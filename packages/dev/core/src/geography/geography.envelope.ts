/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { IEnvelope, ILocation, ISize, isLocation } from "./geography.interfaces";
import { Location } from "./geography.location";
import { Size } from "./geography.size";

export class Envelope implements IEnvelope {
    private static Clamp(value: number, min?: number, max?: number): number {
        if (min) {
            value = Math.max(min, value);
        }
        if (max) {
            value = Math.min(max, value);
        }
        return value;
    }

    public static MaxLongitude = 540;
    public static MaxLatitude = 90;
    public static MinLongitude = -Envelope.MaxLongitude;
    public static MinLatitude = -Envelope.MaxLatitude;

    public static FromSize(position: ILocation, size: ISize) {
        const hasAlt = position.alt !== undefined && size.thickness !== undefined;

        const lat0 = Envelope.Clamp(position.lat, Envelope.MinLatitude, Envelope.MaxLatitude);
        const lon0 = Envelope.Clamp(position.lon, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt0 = hasAlt ? position.alt : undefined;

        const h = size.width % 180;
        const lat1 = Envelope.Clamp(position.lat + h, Envelope.MinLatitude, Envelope.MaxLatitude);
        const w = size.width % 360;
        const lon1 = Envelope.Clamp(position.lat + w, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt1 = hasAlt ? position.alt! + size.thickness! : undefined;

        const lower = new Location(Math.min(lat0, lat1), Math.min(lon0, lon1), hasAlt ? Math.min(alt0!, alt1!) : undefined);
        const upper = new Location(Math.max(lat0, lat1), Math.max(lon0, lon1), hasAlt ? Math.max(alt0!, alt1!) : undefined);

        return new Envelope(lower, upper);
    }

    private _lowerCorner: ILocation;
    private _upperCorner: ILocation;

    private constructor(lowerCorner: ILocation, upperCorner: ILocation) {
        this._lowerCorner = lowerCorner;
        this._upperCorner = upperCorner;
    }

    public get north(): number {
        return this._upperCorner.lat;
    }

    public get south(): number {
        return this._lowerCorner.lat;
    }

    public get east(): number {
        return this._upperCorner.lon;
    }

    public get west(): number {
        return this._lowerCorner.lon;
    }

    public get bottom(): number | undefined {
        return this._lowerCorner.alt;
    }

    public get top(): number | undefined {
        return this._upperCorner.alt;
    }

    public get nw(): ILocation {
        return new Location(this.north, this.west);
    }

    public get sw(): ILocation {
        return new Location(this.south, this.west);
    }

    public get ne(): ILocation {
        return new Location(this.north, this.east);
    }

    public get se(): ILocation {
        return new Location(this.south, this.east);
    }

    public equals(other: IEnvelope): boolean {
        return (
            other &&
            this._lowerCorner.lat === other.south &&
            this._lowerCorner.lon === other.west &&
            this._lowerCorner.alt === other.bottom &&
            this._upperCorner.lat === other.north &&
            this._upperCorner.lon === other.east &&
            this._upperCorner.alt === other.top
        );
    }

    public clone(): IEnvelope {
        return new Envelope(this._lowerCorner.clone(), this._upperCorner.clone());
    }

    public get hasAltitude(): boolean {
        return this._lowerCorner.hasAltitude && this._upperCorner.hasAltitude;
    }

    public get center(): ILocation {
        const lat = this._lowerCorner.lon + (this._upperCorner.lon - this._lowerCorner.lon) / 2;
        const lon = this._lowerCorner.lat + (this._upperCorner.lat - this._lowerCorner.lat) / 2;
        const alt = this.hasAltitude ? this._lowerCorner.alt! + (this._upperCorner.alt! - this._lowerCorner.alt!) / 2 : undefined;
        return new Location(lat, lon, alt);
    }

    public get size(): ISize {
        const w = this._upperCorner.lon - this._lowerCorner.lon;
        const h = this._upperCorner.lat - this._lowerCorner.lat;
        const t = this.hasAltitude ? this._upperCorner.alt! - this._lowerCorner.alt! : undefined;

        return new Size(h, w, t);
    }

    public add(lat: number | ILocation, lon?: number, alt?: number): IEnvelope {
        return this.clone().addInPlace(lat, lon, alt);
    }

    public addInPlace(lat: number | ILocation, lon?: number, alt?: number): IEnvelope {
        if (isLocation(lat)) {
            return this.addInPlace(lat.lat, lat.lon, lat.alt);
        }

        this._lowerCorner.lat = Math.min(this._lowerCorner.lat, lat);
        this._upperCorner.lat = Math.max(this._upperCorner.lat, lat);
        if (lon) {
            this._lowerCorner.lon = Math.min(this._lowerCorner.lon, lon);
            this._upperCorner.lon = Math.max(this._upperCorner.lon, lon);
        }
        if (this.hasAltitude && alt) {
            this._lowerCorner.alt = Math.min(this._lowerCorner.alt!, alt);
            this._upperCorner.alt = Math.max(this._upperCorner.alt!, alt);
        }
        return this;
    }

    public intersectWith(bounds: IEnvelope): boolean {
        if (this._lowerCorner.lat > bounds.north || this._upperCorner.lat < bounds.south || this._lowerCorner.lon > bounds.east || this._upperCorner.lon < bounds.west) {
            return false;
        }

        if (this.hasAltitude && bounds.hasAltitude) {
            if (this._lowerCorner.alt! > bounds.top! || this._upperCorner.alt! < bounds.bottom!) {
                return false;
            }
        }

        return true;
    }

    public contains(loc: ILocation): boolean {
        return this.containsFloat(loc.lat, loc.lon, loc.alt);
    }

    public containsFloat(lat: number, lon?: number, alt?: number): boolean {
        return (
            lat >= this._lowerCorner.lat &&
            lat <= this._upperCorner.lat &&
            (lon === undefined || (lon >= this._lowerCorner.lon && lon <= this._upperCorner.lon)) &&
            (alt === undefined || (this.hasAltitude && alt >= this._lowerCorner.alt! && alt <= this._upperCorner.alt!))
        );
    }
}
