import { Nullable } from "../types";

export interface ICartesian {
    x: number;
    y: number;
    z: number;
}

export interface ILocation {
    lat: number;
    lon: number;
    alt: number;
}

export interface IEnvelope {
    lowercorner: ILocation;
    uppercorner: ILocation;
    equals(other: IEnvelope): boolean;
    clone(): IEnvelope;
    isEmpty(): boolean;
    getCenter(): ILocation;
    getSize(): ILocation;
    add(other: IEnvelope | ILocation | number, lon?: number, ele?: number): IEnvelope;
    intersectWith(bounds: IEnvelope): boolean;
    intersectFromFloat(lat0: number, lon0: number, lat1: number, lon1: number): boolean;
    contains(lat: number | IEnvelope, lon?: number): boolean;
    and(other: IEnvelope): boolean;
}

export interface IGeoBounded {
    bounds: Nullable<IEnvelope>;
}
