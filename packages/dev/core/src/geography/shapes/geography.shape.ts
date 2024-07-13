import { GeoBounded } from "../geography.envelope";
import { IEnvelope } from "../geography.interfaces";
import { IGeoShape, GeoShapeType } from "./geography.shapes.interfaces";

export abstract class GeoShape extends GeoBounded implements IGeoShape {
    _type: GeoShapeType;

    public constructor(t: GeoShapeType) {
        super();
        this._type = t;
    }

    public get type(): GeoShapeType {
        return this._type;
    }

    protected abstract _buildEnvelope(): IEnvelope | undefined;
}
