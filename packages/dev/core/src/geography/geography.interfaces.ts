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

export function IsLocation(b: unknown): b is IGeo2 | IGeo3 {
    if (typeof b !== "object" || b === null) return false;
    return (<IGeo3>b).lat !== undefined && (<IGeo3>b).lon !== undefined;
}

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

    add(lat: number | IGeo2 | IGeo3, lon?: number, alt?: number): IEnvelope;
    addInPlace(lat: number | IGeo2 | IGeo3, lon?: number, alt?: number): IEnvelope;
    unionInPlace(other?: IEnvelope): IEnvelope;
    scaleInPlace(scale: number): IEnvelope;
    intersects(bounds?: IEnvelope): boolean;
    contains(loc?: IGeo3): boolean;
    containsFloat(lat: number, lon?: number, alt?: number): boolean;
    clone(): IEnvelope;
}

export function IsEnvelope(b: unknown): b is IEnvelope {
    if (typeof b !== "object" || b === null) return false;
    return (<IEnvelope>b).nw !== undefined && (<IEnvelope>b).sw !== undefined && (<IEnvelope>b).ne !== undefined && (<IEnvelope>b).nw !== undefined;
}

export interface IGeoBounded {
    geoBounds?: IEnvelope;
}

export function IsGeoBounded(b: unknown): b is IGeoBounded {
    if (typeof b !== "object" || b === null) return false;
    return (<IGeoBounded>b).geoBounds !== undefined && IsEnvelope((<IGeoBounded>b).geoBounds);
}
