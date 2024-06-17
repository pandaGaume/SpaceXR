import { ICartesian3 } from "../geometry.interfaces";
import { Polyline } from "./geometry.polyline";
import { IPolygon, ShapeType } from "./geometry.shapes.interfaces";

export class Polygon extends Polyline implements IPolygon {
    public constructor(p: Array<ICartesian3>) {
        super(p, ShapeType.Polygon);
    }
}
