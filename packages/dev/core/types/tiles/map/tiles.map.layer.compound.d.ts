import { Nullable } from "../../types";
import { ITileAddress, FetchResult, ITileMetrics, ITile } from "../tiles.interfaces";
import { ICompoundLayerDataSource, ITileMapLayer } from "./tiles.map.interfaces";
export declare class CompoundLayerDataSource<T> implements ICompoundLayerDataSource<T> {
    private _layers;
    private _name;
    private _metrics;
    constructor(name: string, metrics: ITileMetrics, ...layers: Array<ITileMapLayer<T>>);
    fetchAsync(address: ITileAddress, dest?: ITile<T>, ...userArgs: unknown[]): Promise<FetchResult<Nullable<T>>>;
    get metrics(): ITileMetrics;
    get layers(): Array<ITileMapLayer<T>>;
    get name(): string;
}
