import { ITile2DAddress, ITileDatasource, ITileContentProvider } from "../../tiles.interfaces";
import { ITileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";

export class Float32Layer extends TileMapLayer<Float32Array> {
    public constructor(
        name: string,
        provider: ITileContentProvider<Float32Array> | ITileDatasource<Float32Array, ITile2DAddress>,
        options?: ITileMapLayerOptions<Float32Array>,
        enabled?: boolean
    ) {
        super(name, provider, options, enabled);
    }
}
