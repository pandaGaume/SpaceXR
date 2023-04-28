import { Tile } from "./tiles";
import { ITileAddress, ITileMetrics } from "./tiles.interfaces";
import { AbstractTileMetrics } from "./tiles.metrics";
import { ICartesian2, IEnvelope, IGeo3, IGeoBounded } from "../geography/geography.interfaces";
export declare class WebMercatorTileMetrics extends AbstractTileMetrics {
    private static D2R;
    static Shared: WebMercatorTileMetrics;
    getLatLonToTileXY(latitude: number, longitude: number, levelOfDetail: number, tileXY?: ICartesian2 | undefined): ICartesian2;
    getTileXYToLatLon(x: number, y: number, levelOfDetail: number, loc?: IGeo3 | undefined): IGeo3;
}
export declare class GeographicTile<T> extends Tile<T> implements IGeoBounded {
    _tileMetrics: ITileMetrics;
    _env?: IEnvelope;
    constructor(data: T, address: ITileAddress, metrics?: ITileMetrics);
    get tileMetrics(): ITileMetrics;
    get bounds(): IEnvelope;
    set bounds(e: IEnvelope | undefined);
    private buildEnvelope;
}
