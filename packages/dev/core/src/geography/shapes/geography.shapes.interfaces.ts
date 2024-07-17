import { IGeo2, IGeoBounded } from "../geography.interfaces";

// we start at 100 to avoid conflicts with geometries
export enum GeoShapeType {
    Unknown = 100,
    Point = 101,
    Line = 102,
    Polyline = 103,
    Polygon = 104,
}

export interface IGeoShape extends IGeoBounded {
    type: GeoShapeType;
}

export function isGeoShape(value: any): value is IGeoShape {
    return value && value.type !== undefined && GeoShapeType[value.type] !== undefined;
}

export interface IGeoPoint extends IGeoShape {
    position: IGeo2;
}

export interface IGeoLine extends IGeoShape {
    start: IGeo2;
    end: IGeo2;
}

export interface IGeoPolyline extends IGeoShape {
    points: IGeo2[];
}

export interface IGeoPolygon extends IGeoPolyline {}
