import { IGeoProcessor, GeodeticSystem, CalculatorBase, SphericalCalculator } from "../../geodesy";
import { GeoBounded } from "../geography.envelope";
import { IEnvelope } from "../geography.interfaces";
import { IGeoShape, GeoShapeType } from "./geography.shapes.interfaces";

export abstract class AbstractGeoShape extends GeoBounded implements IGeoShape {
    _name?: string;
    _system: GeodeticSystem;
    _processor: IGeoProcessor;
    _type: GeoShapeType;

    public constructor(t: GeoShapeType, name?: string, s?: GeodeticSystem, p?: IGeoProcessor) {
        super();
        this._type = t;
        this._name = name;
        this._system = s ?? GeodeticSystem.Default;
        this._processor = p ?? CalculatorBase.Shared ?? SphericalCalculator.Shared;
    }

    public get name(): string | undefined {
        return this._name;
    }

    public get type(): GeoShapeType {
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
