import { IGeoProcessor, GeodeticSystem, CalculatorBase, SphericalCalculator } from "../../geodesy";
import { GeoBounded } from "../geography.envelope";
import { IEnvelope } from "../geography.interfaces";
import { IGeoShape, ShapeType } from "./geography.shapes.interfaces";

export abstract class AbstractShape extends GeoBounded implements IGeoShape {
    _system: GeodeticSystem;
    _processor: IGeoProcessor;
    _type: ShapeType;

    public constructor(t: ShapeType, s?: GeodeticSystem, p?: IGeoProcessor) {
        super();
        this._type = t;
        this._system = s ?? GeodeticSystem.Default;
        this._processor = p ?? CalculatorBase.Shared ?? SphericalCalculator.Shared;
    }

    public get type(): ShapeType {
        return this._type;
    }

    public get system(): GeodeticSystem {
        return this._system;
    }

    public set system(v: GeodeticSystem) {
        if (this._system !== v) {
            this._system = v;
            this.invalidateEnvelope();
        }
    }

    public get processor(): IGeoProcessor {
        return this._processor;
    }

    public set processor(v: IGeoProcessor) {
        if (this._processor !== v) {
            this._processor = v;
            this.invalidateEnvelope();
        }
    }

    protected abstract _buildEnvelope(): IEnvelope | undefined;
}
