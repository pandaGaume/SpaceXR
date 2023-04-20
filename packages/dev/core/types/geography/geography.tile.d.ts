import { Tile } from "shelly/src/tiles/tiles.tile";
import { ITileAddress, ITileMetrics } from "shelly/src/tiles/tiles.interfaces";
import { IEnvelope, IGeoBounded } from "./geography.interfaces";
export declare class GeographicTile<T> extends Tile<T> implements IGeoBounded {
    _tileMetrics: ITileMetrics;
    _env?: IEnvelope;
    constructor(data: T, address: ITileAddress, metrics?: ITileMetrics);
    get tileMetrics(): ITileMetrics;
    get bounds(): IEnvelope;
    set bounds(e: IEnvelope | undefined);
    private buildEnvelope;
}
