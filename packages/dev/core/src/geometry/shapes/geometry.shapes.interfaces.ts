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

export interface ILine extends IShape {
    start: ICartesian3;
    end: ICartesian3;
}

export interface IPolyline extends IShape {
    points: Array<ICartesian3>;
}

export interface IPolygon extends IPolyline {}
