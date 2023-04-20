export interface ICloneable<T> {
    clone(): T;
}

export interface IGeographicValue<T> extends ICloneable<T> {
    equals(other: T): boolean;
}

export interface ICartesian {
    x: number;
    y: number;
    z: number;
}

export interface ILocation extends IGeographicValue<ILocation> {
    lat: number;
    lon: number;
    alt?: number;

    hasAltitude: boolean;
}

export function isLocation(b: unknown): b is ILocation {
    if (typeof b !== "object" || b === null) return false;
    return (<ILocation>b).lat !== undefined && (<ILocation>b).lon !== undefined;
}

export interface ISize extends IGeographicValue<ISize> {
    height: number;
    width: number;
    thickness?: number;

    hasThickness: boolean;
}

export interface IEnvelope extends IGeographicValue<IEnvelope> {
    north: number;
    south: number;
    east: number;
    west: number;
    bottom?: number;
    top?: number;

    nw: ILocation;
    sw: ILocation;
    ne: ILocation;
    se: ILocation;

    hasAltitude: boolean;

    center: ILocation;
    size: ISize;

    add(lat: number | ILocation, lon?: number, alt?: number): IEnvelope;
    addInPlace(lat: number | ILocation, lon?: number, alt?: number): IEnvelope;
    intersectWith(bounds: IEnvelope): boolean;
    contains(loc: ILocation): boolean;
    containsFloat(lat: number, lon?: number, alt?: number): boolean;
}

export function isEnvelope(b: unknown): b is IEnvelope {
    if (typeof b !== "object" || b === null) return false;
    return (<IEnvelope>b).nw !== undefined && (<IEnvelope>b).sw !== undefined && (<IEnvelope>b).ne !== undefined && (<IEnvelope>b).nw !== undefined;
}

export interface IGeoBounded {
    bounds: IEnvelope;
}
