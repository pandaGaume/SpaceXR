import { IBounded, ICartesian3 } from "../geometry.interfaces";

export enum ShapeType {
    Circle,
    Line,
    Polyline,
    Polygon,
}

export interface IShape extends IBounded {
    type: ShapeType;
}

export interface ICircle extends IShape {
    center: ICartesian3;
    radius: number;
}

export function isCircle(shape: IShape): shape is ILine {
    return shape.type === ShapeType.Circle;
}

export interface ILine extends IShape {
    start: ICartesian3;
    end: ICartesian3;
}

export function isLine(shape: IShape): shape is ILine {
    return shape.type === ShapeType.Line;
}

export interface IPolyline extends IShape {
    points: Array<ICartesian3>;
}

export function isPolyline(shape: IShape): shape is IPolyline {
    return shape.type === ShapeType.Polyline;
}

export interface IPolygon extends IPolyline {}

export function isPolygon(shape: IShape): shape is IPolygon {
    return shape.type === ShapeType.Polygon;
}
