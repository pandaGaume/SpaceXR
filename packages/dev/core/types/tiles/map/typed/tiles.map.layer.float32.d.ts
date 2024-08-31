import { ITileAddress, ITileDatasource, ITileContentProvider } from "../../tiles.interfaces";
import { ITileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
export declare class Float32Layer extends TileMapLayer<Float32Array> {
    constructor(name: string, provider: ITileContentProvider<Float32Array> | ITileDatasource<Float32Array, ITileAddress>, options?: ITileMapLayerOptions<Float32Array>, enabled?: boolean);
}
