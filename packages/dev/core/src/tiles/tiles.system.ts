import { ITile, ITileAddress, ITileBuilder, ITileClient, ITileMetrics, ITileSystem } from "./tiles.interfaces";

export class TileSystem<V, T extends ITile<V>, R extends ITileAddress> implements ITileSystem<V, T, R> {
    public constructor(public metrics: ITileMetrics, public client: Array<ITileClient<V, R>>, public builder: ITileBuilder<V, T>) {}
}
