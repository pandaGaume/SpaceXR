import { Envelope } from "../geography.envelope";
import { IEnvelope, IGeo2 } from "../geography.interfaces";
import { GeoShape } from "./geography.shape";
import { GeoShapeType, IGeoPoint } from "./geography.shapes.interfaces";

export class GeoPoint extends GeoShape implements IGeoPoint {
    _position: IGeo2;

    public constructor(p: IGeo2) {
        super(GeoShapeType.Point);
        this._position = p;
    }

    public get position(): IGeo2 {
        return this._position;
    }

    public set position(v: IGeo2) {
        if (!this._position.equals(v)) {
            this._position = v;
            this.invalidateEnvelope();
        }
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        return Envelope.FromPoints(this._position);
    }
}
