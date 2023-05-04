import { ITileAddress, ITileMetrics, LookupData } from "./tiles.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle, ISize2 } from "../geometry/geometry.interfaces";
export declare class TileComponent<T> implements ITileAddress {
    _x: number;
    _y: number;
    _levelOfDetail: number;
    _px: number;
    _py: number;
    _value?: LookupData<T>;
    constructor(x: number, y: number, levelOfDetail: number, px: number, py: number);
    get address(): ITileAddress | undefined;
    get x(): number;
    get y(): number;
    get levelOfDetail(): number;
    get data(): LookupData<T>;
    set data(v: LookupData<T>);
    get px(): number;
    get py(): number;
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
    _tiles: Array<TileComponent<T>>;
    constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?: ITileMetrics);
    get tiles(): Array<TileComponent<T>>;
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
