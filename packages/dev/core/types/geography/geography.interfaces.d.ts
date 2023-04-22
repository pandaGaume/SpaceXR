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
export interface IGeo2 extends IGeographicValue<IGeo2> {
    lat: number;
    lon: number;
}
export interface IGeo3 extends IGeographicValue<IGeo3> {
    lat: number;
    lon: number;
    alt?: number;
    hasAltitude: boolean;
}
export declare function isLocation(b: unknown): b is IGeo3;
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
    nw: IGeo3;
    sw: IGeo3;
    ne: IGeo3;
    se: IGeo3;
    hasAltitude: boolean;
    center: IGeo3;
    size: ISize;
    add(lat: number | IGeo3, lon?: number, alt?: number): IEnvelope;
    addInPlace(lat: number | IGeo3, lon?: number, alt?: number): IEnvelope;
    intersectWith(bounds: IEnvelope): boolean;
    contains(loc: IGeo3): boolean;
    containsFloat(lat: number, lon?: number, alt?: number): boolean;
}
export declare function isEnvelope(b: unknown): b is IEnvelope;
export interface IGeoBounded {
    bounds: IEnvelope;
}
