import { Nullable } from "../../types";
import { ITileAddress, FetchResult, ITileMetrics, ITile } from "../tiles.interfaces";
import { ICompoundLayerDataSource, ITileMapLayer } from "./tiles.map.interfaces";

export class CompoundLayerDataSource<T> implements ICompoundLayerDataSource<T> {
    private _layers: Array<ITileMapLayer<T>>;
    private _name: string;
    private _metrics: ITileMetrics;

    constructor(name: string, metrics: ITileMetrics, ...layers: Array<ITileMapLayer<T>>) {
        this._name = name;
        this._metrics = metrics;
        this._layers = layers;
    }

    public async fetchAsync(address: ITileAddress, dest?: ITile<T>, ...userArgs: unknown[]): Promise<FetchResult<Nullable<T>>> {
        return new FetchResult(address, null);
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }
    public get layers(): Array<ITileMapLayer<T>> {
        return this._layers;
    }
    public get name(): string {
        return this._name;
    }
}
