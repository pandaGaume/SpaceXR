import { IGeo2, IGeo3 } from "./geography.interfaces";
import { GeoJsonCoordinate } from "./standards/geojson/geojson.interface";

export class Geo2 implements IGeo2 {
    public static Default = new Geo2(46.382581, -0.308024);

    public static FromGeoJson(coordinates: GeoJsonCoordinate): IGeo2 {
        return new Geo2(coordinates[1], coordinates[0]);
    }

    public static Parse(value: string): IGeo2 {
        // Remove the brackets and split the string by comma
        const parts = value.replace(/[\[\]]/g, "").split(",");
        // Parse the latitude and longitude
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        return new Geo2(lat, lon);
    }

    public static ToString(value: IGeo2): string {
        return `[${value.lat},${value.lon}]`;
    }

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

    public toString(): string {
        return `[${this._lat},${this._lon}]`;
    }
}

export class Geo3 extends Geo2 implements IGeo3 {
    public static FromGeoJson(coordinates: GeoJsonCoordinate): IGeo3 {
        if (coordinates.length === 2) {
            return new Geo3(coordinates[1], coordinates[0]);
        }
        return new Geo3(coordinates[1], coordinates[0], coordinates[2]);
    }

    public static ToString(value: IGeo3): string {
        if (value.alt !== undefined) {
            return `[${value.lat},${value.lon},${value.alt}]`;
        }
        return `[${value.lat},${value.lon}]`;
    }

    public static Parse(value: string): IGeo3 {
        // Remove the brackets and split the string by comma
        const parts = value.replace(/[\[\]]/g, "").split(",");
        // Parse the latitude and longitude
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        // Check if altitude is provided
        if (parts.length > 2) {
            const alt = parseFloat(parts[2]);
            return new Geo3(lat, lon, alt);
        }
        return new Geo3(lat, lon);
    }

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
    public toString(): string {
        return this.hasAltitude ? `(${this._lat}, ${this._lon}, ${this._alt})` : `(${this._lat}, ${this._lon})`;
    }
}
