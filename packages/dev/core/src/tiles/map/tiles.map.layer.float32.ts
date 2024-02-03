import { ITileAddress, ITileDatasource, ITileProvider } from "../tiles.interfaces";
import { ITileMapLayerOptions } from "./tiles.map.interfaces";
import { TileMapLayer } from "./tiles.map.layer";

export class Float32Layer extends TileMapLayer<Float32Array> {
    public constructor(name: string, provider: ITileProvider<Float32Array> | ITileDatasource<Float32Array, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean) {
        super(name, provider, options, enabled);
    }
}