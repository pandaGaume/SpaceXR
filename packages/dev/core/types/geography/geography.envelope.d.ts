import { IEnvelope, IGeo2, IGeo3, IGeoBounded } from "./geography.interfaces";
import { ISize3, ISize2 } from "../geometry/geometry.interfaces";
export declare class Envelope implements IEnvelope {
    static MaxLongitude: number;
    static MaxLatitude: number;
    static MinLongitude: number;
    static MinLatitude: number;
    static Zero(): IEnvelope;
    static FromSize(position: IGeo3 | IGeo2, size: ISize3 | ISize2): Envelope;
    static FromPoints(...array: (IGeo3 | IGeo2)[]): IEnvelope | undefined;
    static FromEnvelopes(...array: (IEnvelope | undefined | null)[]): IEnvelope | undefined;
    _min: IGeo3;
    _max: IGeo3;
    private constructor();
    get north(): number;
    get south(): number;
    get east(): number;
    get west(): number;
    get bottom(): number | undefined;
    get top(): number | undefined;
    get nw(): IGeo3;
    get sw(): IGeo3;
    get ne(): IGeo3;
    get se(): IGeo3;
    equals(other: IEnvelope): boolean;
    clone(): IEnvelope;
    get hasAltitude(): boolean;
    get center(): IGeo3;
    get size(): ISize3;
    add(lat: number | IGeo2 | IGeo3, lon?: number, alt?: number): IEnvelope;
    addInPlace(lat: number | IGeo2 | IGeo3, lon?: number, alt?: number): IEnvelope;
    unionInPlace(other: IEnvelope): IEnvelope;
    intersectWith(bounds: IEnvelope): boolean;
    contains(loc: IGeo3): boolean;
    containsFloat(lat: number, lon?: number, alt?: number): boolean;
}
export declare abstract class GeoBounded implements IGeoBounded {
    _parent?: GeoBounded;
    _env?: IEnvelope;
    constructor(parent?: GeoBounded);
    get bounds(): IEnvelope | undefined;
    validateEnvelope(): void;
    invalidateEnvelope(): void;
    protected abstract _buildEnvelope(b: IEnvelope): IEnvelope | undefined;
}
