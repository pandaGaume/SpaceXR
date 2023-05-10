import { ITileAddress, ITileMetrics } from "./tiles.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle, ISize2, ICartesian2 } from "../geometry/geometry.interfaces";
import { Observable } from "../events";
export declare class UpdateEvents {
    lod: number;
    bounds: IRectangle;
    scale: ICartesian2;
    added?: Map<string, ITileAddress> | undefined;
    removed?: Map<string, ITileAddress> | undefined;
    remain?: Map<string, ITileAddress> | undefined;
    constructor(lod: number, bounds: IRectangle, scale: ICartesian2, added?: Map<string, ITileAddress> | undefined, removed?: Map<string, ITileAddress> | undefined, remain?: Map<string, ITileAddress> | undefined);
    toString(): string;
}
export declare class TileMapView {
    static ZOOM_ACC: number;
    _metrics: ITileMetrics;
    _center: IGeo2;
    _size: ISize2;
    _levelOfDetail: number;
    _valid: boolean;
    _innerbounds: IRectangle;
    _outerbounds: IRectangle;
    _outerboundsTileXY: IRectangle;
    _tiles: Array<ITileAddress>;
    _scale: ICartesian2;
    _updateObservable?: Observable<UpdateEvents>;
    constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?: ITileMetrics);
    get updateObservable(): Observable<UpdateEvents>;
    get metrics(): ITileMetrics;
    get tiles(): Array<ITileAddress>;
    get bounds(): IRectangle;
    get levelOfDetail(): number;
    get width(): number;
    get height(): number;
    get lat(): number;
    get lon(): number;
    get isValid(): boolean;
    setLevelOfDetail(v: number): TileMapView;
    resize(width: number, height: number): TileMapView;
    center(lat?: number, lon?: number): TileMapView;
    translate(x: number, y: number): TileMapView;
    invalidate(): TileMapView;
    validate(): TileMapView;
    protected doValidate(): void;
}
