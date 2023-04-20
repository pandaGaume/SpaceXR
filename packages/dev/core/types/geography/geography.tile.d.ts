import { Tile } from "shelly/src/tiles/tiles.tile";
import { ITileAddress, ITileMetrics } from "shelly/src/tiles/tiles.interfaces";
import { IEnvelope, IGeoBounded } from "./geography.interfaces";
export declare class GeographicTile<T> extends Tile<T> implements IGeoBounded {
    _metrics: ITileMetrics;
    _env?: IEnvelope;
    constructor(data: T, address: ITileAddress, metrics: ITileMetrics);
    get metrics(): ITileMetrics;
    get bounds(): IEnvelope | undefined;
    set bounds(e: IEnvelope | undefined);
    private buildEnvelope;
}
