import { GeodeticSystem } from "../geodesy/geodesy.system";
import { GeoBounded } from "./geography.envelope";
import { IEnvelope } from "./geography.interfaces";
export declare abstract class AbstractShape extends GeoBounded {
    _system: GeodeticSystem;
    constructor(s?: GeodeticSystem);
    get system(): GeodeticSystem;
    set system(v: GeodeticSystem);
    protected abstract _buildEnvelope(): IEnvelope | undefined;
}
export declare class GeoCircle extends AbstractShape {
    lat: number;
    lon: number;
    radius: number;
    constructor(lat: number, lon: number, radius: number);
    protected _buildEnvelope(): IEnvelope | undefined;
}
