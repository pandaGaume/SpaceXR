import { Bounds2 } from "../geometry.bounds";
import { IBounds2, ICartesian3 } from "../geometry.interfaces";
import { AbstractShape } from "./geometry.shape";
import { IPolyline, ShapeType } from "./geometry.shapes.interfaces";

export class Polyline extends AbstractShape implements IPolyline {

    _points: Array<ICartesian3>;

    public constructor(p: Array<ICartesian3>, type?: ShapeType) {
        super(type ?? ShapeType.Polyline);
        this._points = p;
    }

    public get points(): Array<ICartesian3> {
        return this._points;
    }

    protected _buildBounds(): IBounds2 | undefined {
        return Bounds2.FromPoints(...this._points);
    }
}
