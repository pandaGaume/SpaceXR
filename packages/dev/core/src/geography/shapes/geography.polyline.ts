import { GeodeticSystem, IGeoProcessor } from "../../geodesy";
import { Envelope } from "../geography.envelope";
import { IEnvelope, IGeo2 } from "../geography.interfaces";
import { AbstractShape } from "./geography.shape";
import { IGeoPolyline, ShapeType } from "./geography.shapes.interfaces";

export class GeoPolyline extends AbstractShape implements IGeoPolyline {
    _points: Array<IGeo2>;

    public constructor(p: Array<IGeo2>, s?: GeodeticSystem, proc?: IGeoProcessor, type?: ShapeType) {
        super(type ?? ShapeType.Polyline, s, proc);
        this._points = p;
    }

    public get points(): Array<IGeo2> {
        return this._points;
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        return Envelope.FromPoints(...this._points);
    }
}
