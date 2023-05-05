import { ITileAddress, ITileMetrics } from "./tiles.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { Observable } from "../events";
export declare class UpdateEvents {
    bounds: IRectangle;
    added?: ITileAddress[] | undefined;
    removed?: ITileAddress[] | undefined;
    remain?: ITileAddress[] | undefined;
    constructor(bounds: IRectangle, added?: ITileAddress[] | undefined, removed?: ITileAddress[] | undefined, remain?: ITileAddress[] | undefined);
}
export declare class View2<T> {
    _metrics: ITileMetrics;
    _center: IGeo2;
    _size: ISize2;
    _levelOfDetail: number;
    _levelOfDetailOffset: number;
    _valid: boolean;
    _innerbounds: IRectangle;
    _outerbounds: IRectangle;
    _outerboundsTileXY: IRectangle;
    _tiles: Array<ITileAddress>;
    _updateObservable?: Observable<UpdateEvents>;
    constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?: ITileMetrics);
    get updateObservable(): Observable<UpdateEvents>;
    get metrics(): ITileMetrics;
    get tiles(): Array<ITileAddress>;
    get bounds(): IRectangle;
    get levelOfDetail(): number;
    set levelOfDetail(v: number);
    get width(): number;
    get height(): number;
    get lat(): number;
    get lon(): number;
    get scaling(): number;
    get levelOfDetailOffset(): number;
    get isValid(): boolean;
    resize(width: number, height: number): View2<T>;
    center(lat?: number, lon?: number): View2<T>;
    invalidate(): View2<T>;
    validate(): View2<T>;
    protected doValidate(): void;
}
