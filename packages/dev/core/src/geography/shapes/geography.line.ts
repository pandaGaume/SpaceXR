import { Envelope } from "../geography.envelope";
import { IEnvelope, IGeo2 } from "../geography.interfaces";
import { GeoShape } from "./geography.shape";
import { IGeoLine, GeoShapeType } from "./geography.shapes.interfaces";

export class GeoLine extends GeoShape implements IGeoLine {
    _alice: IGeo2;
    _bob: IGeo2;

    public constructor(a: IGeo2, b: IGeo2) {
        super(GeoShapeType.Line);
        this._alice = a;
        this._bob = b;
    }

    public get start(): IGeo2 {
        return this._alice;
    }

    public set start(v: IGeo2) {
        if (!this._alice.equals(v)) {
            this._alice = v;
            this.invalidateEnvelope();
        }
    }

    public get end(): IGeo2 {
        return this._bob;
    }

    public set end(v: IGeo2) {
        if (!this._bob.equals(v)) {
            this._bob = v;
            this.invalidateEnvelope();
        }
    }

    protected _buildEnvelope(): IEnvelope | undefined {
        return Envelope.FromPoints(this._alice, this._bob);
    }
}
