import { IEnvelope } from "../geography/geography.interfaces";
import { ITile, ITileAddress, ITileMetrics } from "./tiles.interfaces";
export declare class Tile<T> implements ITile<T>, ITileAddress {
    static BuildEnvelope(x: number, y: number, lod: number, metrics?: ITileMetrics): IEnvelope | undefined;
    _x: number;
    _y: number;
    _levelOfDetail: number;
    _value?: T;
    _env?: IEnvelope;
    constructor(x: number, y: number, levelOfDetail: number, data?: T, metrics?: ITileMetrics);
    get address(): ITileAddress | undefined;
    get data(): T | undefined;
    get x(): number;
    get y(): number;
    get levelOfDetail(): number;
    get bounds(): IEnvelope | undefined;
    set bounds(e: IEnvelope | undefined);
}
