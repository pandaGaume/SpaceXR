import { IEnvelope, IGeo2, IGeo3, IGeoBounded } from "./geography.interfaces";
import { ISize3 } from "../geometry/geometry.interfaces";
export declare class Envelope implements IEnvelope {
    static MaxLongitude: number;
    static MaxLatitude: number;
    static MinLongitude: number;
    static MinLatitude: number;
    static Zero(): IEnvelope;
    static Split2(a: IEnvelope | IGeoBounded | undefined): IEnvelope[];
    static Split3(a: IEnvelope | IGeoBounded | undefined): IEnvelope[];
    static FromPoints(...array: (IGeo3 | IGeo2)[]): IEnvelope | undefined;
    static FromEnvelopes(...array: Array<IEnvelope | IGeoBounded | undefined | null>): IEnvelope | undefined;
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
    equals(other?: IEnvelope): boolean;
    clone(): IEnvelope;
    get hasAltitude(): boolean;
    get center(): IGeo3;
    get size(): ISize3;
    add(lat: number | IGeo2 | IGeo3, lon?: number, alt?: number): IEnvelope;
    addInPlace(lat: number | IGeo2 | IGeo3, lon?: number, alt?: number): IEnvelope;
    unionInPlace(other: IEnvelope): IEnvelope;
    intersects(bounds?: IEnvelope): boolean;
    contains(loc?: IGeo3): boolean;
    containsFloat(lat: number, lon?: number, alt?: number): boolean;
    toString(): string;
}
export declare abstract class GeoBounded implements IGeoBounded {
    _parent?: GeoBounded;
    _env?: IEnvelope;
    constructor(bounds?: IEnvelope, parent?: GeoBounded);
    get parent(): GeoBounded | undefined;
    get geoBounds(): IEnvelope | undefined;
    validateEnvelope(): void;
    invalidateEnvelope(): void;
    protected abstract _buildEnvelope(): IEnvelope | undefined;
}
