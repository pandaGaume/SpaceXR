import { GeodeticSystem, IGeoProcessor } from "../../geodesy";
import { Envelope } from "../geography.envelope";
import { IEnvelope, IGeo2 } from "../geography.interfaces";
import { AbstractGeoShape } from "./geography.shape";
import { IGeoPolyline, GeoShapeType } from "./geography.shapes.interfaces";

export class GeoPolyline extends AbstractGeoShape implements IGeoPolyline {
    _points: Array<IGeo2>;

    public constructor(name: string, p: Array<IGeo2>, s?: GeodeticSystem, proc?: IGeoProcessor, type?: GeoShapeType) {
        super(type ?? GeoShapeType.Polyline, name, s, proc);
        this._points = p;
    }

    public get points(): Array<IGeo2> {
        return this._points;
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        return Envelope.FromPoints(...this._points);
    }
}
