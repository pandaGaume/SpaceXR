/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Scalar } from "../math/math";
import { IEnvelope, IGeo2, IGeo3, IGeoBounded, IsEnvelope, IsGeoBounded, IsLocation } from "./geography.interfaces";
import { ISize3 } from "../geometry/geometry.interfaces";
import { Geo3 } from "./geography.position";
import { Size3 } from "../geometry/geometry.size";

export class Envelope implements IEnvelope {
    public static MaxLongitude = 540;
    public static MaxLatitude = 90;
    public static MinLongitude = -Envelope.MaxLongitude;
    public static MinLatitude = -Envelope.MaxLatitude;

    public static Zero(): IEnvelope {
        return new Envelope(Geo3.Zero(), Geo3.Zero());
    }

    /// <summary>
    /// Split the envelope in 4 equal parts
    ///  +----+----+
    ///  | 0  | 1  |
    ///  +----+----+
    ///  | 2  | 3  |
    ///  +----+----+
    /// </summary>
    public static Split2(a: IEnvelope | IGeoBounded | undefined): IEnvelope[] {
        if (a) {
            if (IsGeoBounded(a)) {
                return Envelope.Split2(a.geoBounds);
            }
            const center = a.center;
            return [
                new Envelope(new Geo3(center.lat, a.west), new Geo3(a.north, center.lon)),
                new Envelope(center, new Geo3(a.north, a.east)),
                new Envelope(new Geo3(a.south, a.west), center),
                new Envelope(new Geo3(a.south, center.lon), new Geo3(center.lat, a.east)),
            ];
        }
        return [];
    }

    /// <summary>
    /// Split the envelope in 8 equal parts (3D)
    ///  +----+----+
    ///  | 0  | 1  |
    ///  +----+----+ bottom
    ///  | 2  | 3  |
    ///  +----+----+
    ///  +----+----+
    ///  | 4  | 5  |
    ///  +----+----+ top
    ///  | 6  | 7  |
    ///  +----+----+
    /// </summary>
    public static Split3(a: IEnvelope | IGeoBounded | undefined): IEnvelope[] {
        if (a) {
            if (IsGeoBounded(a)) {
                return Envelope.Split3(a.geoBounds);
            }
            if (a.hasAltitude) {
                const center = a.center;
                return [
                    new Envelope(new Geo3(center.lat, a.west, a.bottom), new Geo3(a.north, center.lon, center.alt)),
                    new Envelope(new Geo3(center.lat, center.lon, a.bottom), new Geo3(a.north, a.east, center.alt)),
                    new Envelope(new Geo3(a.south, a.west, a.bottom), center),
                    new Envelope(new Geo3(a.south, center.lon, a.bottom), new Geo3(center.lat, a.east, center.alt)),

                    new Envelope(new Geo3(center.lat, a.west, center.alt), new Geo3(a.north, center.lon, a.top)),
                    new Envelope(new Geo3(center.lat, center.lon, center.alt), new Geo3(a.north, a.east, a.top)),
                    new Envelope(new Geo3(a.south, a.west, center.alt), new Geo3(center.lat, center.lon, a.top)),
                    new Envelope(new Geo3(a.south, center.lon, center.alt), new Geo3(center.lat, a.east, a.top)),
                ];
            }
        }
        return [];
    }

    public static FromPoints(...array: (IGeo3 | IGeo2)[]): IEnvelope | undefined {
        const a = array[0];

        const hasAlt = (<IGeo3>a).alt !== undefined && (<IGeo3>a).alt !== undefined;

        const lat0 = Scalar.Clamp(a.lat, Envelope.MinLatitude, Envelope.MaxLatitude);
        const lon0 = Scalar.Clamp(a.lon, Envelope.MinLongitude, Envelope.MaxLongitude);
        const alt0 = hasAlt ? (<IGeo3>a).alt : undefined;

        const env = new Envelope(new Geo3(lat0, lon0, alt0), new Geo3(lat0, lon0, alt0));
        for (let i = 1; i < array.length; i++) {
            env.addInPlace(array[i]);
        }
        return env;
    }

    public static FromEnvelopes(...array: Array<IEnvelope | IGeoBounded | undefined | null>): IEnvelope | undefined {
        let env: IEnvelope | undefined = undefined;
        for (let i = 0; i < array.length; i++) {
            let a = array[i];
            if (a) {
                if (IsEnvelope(a)) {
                    env = env ? env.unionInPlace(a) : a.clone();
                } else {
                    a = a.geoBounds;
                    if (a) {
                        env = env ? env.unionInPlace(a) : a.clone();
                    }
                }
            }
        }
        return env;
    }

    _min: IGeo3;
    _max: IGeo3;

    private constructor(lowerCorner: IGeo3, upperCorner: IGeo3) {
        this._min = lowerCorner;
        this._max = upperCorner;
    }

    public isEmpty(): boolean {
        return this._min.equals(this._max);
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

    public equals(other?: IEnvelope): boolean {
        return (
            other !== undefined &&
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
        const lon = this._min.lon + (this._max.lon - this._min.lon) / 2;
        const lat = this._min.lat + (this._max.lat - this._min.lat) / 2;
        const alt = this.hasAltitude ? this._min.alt! + (this._max.alt! - this._min.alt!) / 2 : undefined;
        return new Geo3(lat, lon, alt);
    }

    public get size(): ISize3 {
        const w = this._max.lon - this._min.lon;
        const h = this._max.lat - this._min.lat;
        const t = this.hasAltitude ? this._max.alt! - this._min.alt! : 0;

        return new Size3(w, h, t);
    }

    public add(lat: number | IGeo2 | IGeo3, lon?: number, alt?: number): IEnvelope {
        return this.clone().addInPlace(lat, lon, alt);
    }

    public addInPlace(lat: number | IGeo2 | IGeo3, lon?: number, alt?: number): IEnvelope {
        if (IsLocation(lat)) {
            return this.addInPlace(lat.lat, lat.lon, (<IGeo3>lat).alt);
        }

        this._min.lat = Math.min(this._min.lat, lat);
        this._max.lat = Math.max(this._max.lat, lat);
        if (lon !== undefined) {
            this._min.lon = Math.min(this._min.lon, lon);
            this._max.lon = Math.max(this._max.lon, lon);
        }
        if (this.hasAltitude && alt) {
            this._min.alt = Math.min(this._min.alt!, alt);
            this._max.alt = Math.max(this._max.alt!, alt);
        }
        return this;
    }

    public unionInPlace(other: IEnvelope): IEnvelope {
        this._min.lat = Math.min(this._min.lat, other.south);
        this._max.lat = Math.max(this._max.lat, other.north);
        this._min.lon = Math.min(this._min.lon, other.west);
        this._max.lon = Math.max(this._max.lon, other.east);
        if (this.hasAltitude && other.hasAltitude) {
            this._min.alt = Math.min(this._min.alt!, other.bottom!);
            this._max.alt = Math.max(this._max.alt!, other.top!);
        }
        return this;
    }

    public intersects(bounds?: IEnvelope): boolean {
        if (bounds === undefined) return false;
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

    public contains(other?: IEnvelope | IGeo3): boolean {
        if (!other) return false;

        if (IsLocation(other)) {
            return this.containsFloat(other.lat, other.lon, other.alt);
        }
        // Check if all corners of the `other` envelope are within the current envelope
        return (
            this.containsFloat(other.south, other.west) && // South-West corner
            this.containsFloat(other.north, other.east) && // North-East corner
            (!this.hasAltitude || // Skip altitude check if not applicable
                (other.bottom !== undefined &&
                    other.top !== undefined &&
                    this.containsFloat(other.bottom, undefined, other.bottom) &&
                    this.containsFloat(other.top, undefined, other.top)))
        );
    }

    public containsFloat(lat: number, lon?: number, alt?: number): boolean {
        return (
            lat >= this._min.lat &&
            lat <= this._max.lat &&
            (lon === undefined || (lon >= this._min.lon && lon <= this._max.lon)) &&
            (alt === undefined || (this.hasAltitude && alt >= this._min.alt! && alt <= this._max.alt!))
        );
    }

    public scaleInPlace(scale: number): IEnvelope {
        const size = this.size;
        size.width = (size.width * scale - size.width) / 2;
        size.height = (size.height * scale - size.height) / 2;
        size.depth = (size.depth * scale - size.depth) / 2;

        this._min.lat -= size.height;
        this._min.lon -= size.width;
        if (this._min.alt) {
            this._min.alt -= size.depth;
        }
        this._max.lat += size.height;
        this._max.lon += size.width;
        if (this._max.alt) {
            this._max.alt += size.depth;
        }
        return this;
    }

    public toString(): string {
        return `Envelope(${this._min.toString()}, ${this._max.toString()})`;
    }
}

export abstract class GeoBounded implements IGeoBounded {
    _parent?: GeoBounded;
    _env?: IEnvelope;

    public constructor(bounds?: IEnvelope, parent?: GeoBounded) {
        if (parent) {
            this._parent = parent;
        }
        this._env = bounds;
    }

    public get parent(): GeoBounded | undefined {
        return this._parent;
    }

    public get geoBounds(): IEnvelope | undefined {
        this.validateEnvelope();
        return this._env;
    }

    public validateEnvelope(): void {
        if (!this._env) {
            this._env = this._buildEnvelope();
        }
    }

    public invalidateEnvelope(): void {
        if (this._env) {
            delete this._env;
            if (this._parent) {
                this._parent.invalidateEnvelope();
            }
        }
    }

    protected abstract _buildEnvelope(): IEnvelope | undefined;
}
