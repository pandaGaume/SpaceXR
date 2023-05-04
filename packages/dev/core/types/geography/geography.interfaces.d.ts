import { ISize3 } from "../geometry/geometry.interfaces";
import { IComparable, ICloneable } from "../types";
export interface IGeo2 extends IComparable<IGeo2>, ICloneable<IGeo2> {
    lat: number;
    lon: number;
}
export interface IGeo3 extends IComparable<IGeo3>, ICloneable<IGeo3> {
    lat: number;
    lon: number;
    alt?: number;
    hasAltitude: boolean;
}
export declare function isLocation(b: unknown): b is IGeo3;
export interface IEnvelope extends IComparable<IEnvelope> {
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
    size: ISize3;
    add(lat: number | IGeo3, lon?: number, alt?: number): IEnvelope;
    addInPlace(lat: number | IGeo3, lon?: number, alt?: number): IEnvelope;
    intersectWith(bounds: IEnvelope): boolean;
    contains(loc: IGeo3): boolean;
    containsFloat(lat: number, lon?: number, alt?: number): boolean;
}
export declare function isEnvelope(b: unknown): b is IEnvelope;
export interface IGeoBounded {
    bounds?: IEnvelope;
}
