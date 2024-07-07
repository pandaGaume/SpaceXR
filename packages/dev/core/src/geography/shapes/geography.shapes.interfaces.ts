import { GeodeticSystem, IGeoProcessor } from "../../geodesy";
import { IGeo2, IGeoBounded } from "../geography.interfaces";

// we start at 100 to avoid conflicts with geometries
export enum GeoShapeType {
    Unknown = 100,
    Circle = 101,
    Line = 102,
    Polyline = 103,
    Polygon = 104,
    Mesh = 105,
}

export interface IGeoShape extends IGeoBounded {
    name?: string;
    type: GeoShapeType;
    system?: GeodeticSystem;
    processor?: IGeoProcessor;
}

export function isGeoShape(value: any): value is IGeoShape {
    return value && value.type !== undefined && GeoShapeType[value.type] !== undefined;
}

export interface IGeoCircle extends IGeoShape {
    center: IGeo2;
    radius: number;
    toPolygon(step: number): IGeoPolygon;
}

export interface IGeoLine extends IGeoShape {
    start: IGeo2;
    end: IGeo2;
}

export interface IGeoPolyline extends IGeoShape {
    points: IGeo2[];
}

export interface IGeoPolygon extends IGeoPolyline {}
