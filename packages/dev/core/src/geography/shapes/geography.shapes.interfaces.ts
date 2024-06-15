import { GeodeticSystem, IGeoProcessor } from "../../geodesy";
import { IGeo2, IGeoBounded } from "../geography.interfaces";

export enum ShapeType {
    Circle,
    Line,
    Polyline,
    Polygon,
    Mesh,
}

export interface IGeoShape extends IGeoBounded {
    type: ShapeType;
    system?: GeodeticSystem;
    processor?: IGeoProcessor;
}

export interface IGeoCircle extends IGeoShape {
    center: IGeo2;
    radius: number;
}

export interface IGeoLine extends IGeoShape {
    start: IGeo2;
    end: IGeo2;
}

export interface IGeoPolyline extends IGeoShape {
    points: IGeo2[];
}

export interface IGeoPolygon extends IGeoPolyline {}
