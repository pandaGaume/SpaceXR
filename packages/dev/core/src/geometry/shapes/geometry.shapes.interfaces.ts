import { IBounded, IBounds2, ICartesian3 } from "../geometry.interfaces";

export enum ShapeType {
    Unknown,
    Point,
    Polyline,
    Polygon,
    Circle,
    Line,
}

export interface IClipable {
    /// <Resume>
    /// clip to a bounding box. return the clipped shape or undefined if the whole shape is outside the clip area.
    /// the result may be a single shape or an array of shapes. In all cases the original shape is NOT modified.
    /// </Resume>
    clip?(clipArea: IBounds2): IShape | Array<IShape> | undefined;
}

export interface IShape extends IBounded, IClipable {
    type: ShapeType;
}

export function isClipable(value: any): value is IClipable {
    return value && value.clip && typeof value.clip === "function";
}

export function isShape(value: any): value is IShape {
    return value && value.type !== undefined && ShapeType[value.type] !== undefined;
}

export interface IPoint extends IShape {
    position: ICartesian3;
}

export interface ICircle extends IShape {
    center: ICartesian3;
    radius: number;
}

export function isCircle(shape: IShape): shape is ILine {
    if (typeof shape !== "object" || shape === null) return false;
    return shape.type === ShapeType.Circle;
}

export interface ILine extends IShape {
    start: ICartesian3;
    end: ICartesian3;
}

export function isLine(shape: IShape): shape is ILine {
    if (typeof shape !== "object" || shape === null) return false;
    return shape.type === ShapeType.Line;
}

export interface IPolyline extends IShape {
    points: Array<ICartesian3>;
    reverseInPlace(): IShape;
}

export function isPolyline(shape: IShape): shape is IPolyline {
    if (typeof shape !== "object" || shape === null) return false;
    return shape.type === ShapeType.Polyline;
}

export interface IPolygon extends IPolyline {
    isClockWise: boolean;
}

export function isPolygon(shape: IShape): shape is IPolygon {
    if (typeof shape !== "object" || shape === null) return false;
    return shape.type === ShapeType.Polygon;
}
