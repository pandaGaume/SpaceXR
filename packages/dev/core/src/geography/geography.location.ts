import { ILocation } from "./geography.interfaces";

export class Location implements ILocation {
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

    public clone(): ILocation {
        return new Location(this._lat, this._lon, this._alt);
    }

    public equals(other: ILocation): boolean {
        return this._lat === other.lat && this._lon === other.lon && this._alt === other.alt;
    }
}
