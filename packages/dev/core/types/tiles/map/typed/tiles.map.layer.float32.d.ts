import { ITile2DAddress, ITileDatasource, ITileContentFetcher } from "../../tiles.interfaces";
import { ITileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
export declare class Float32Layer extends TileMapLayer<Float32Array> {
    constructor(name: string, provider: ITileContentFetcher<Float32Array> | ITileDatasource<Float32Array, ITile2DAddress>, options?: ITileMapLayerOptions<Float32Array>, enabled?: boolean);
}
