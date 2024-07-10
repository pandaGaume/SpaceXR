import { Tile } from "../tiles";
import { ITileMetrics, TileContentType } from "../tiles.interfaces";
import { IVectorTileContent } from "./tiles.vector.interfaces";

export class VectorTile extends Tile<IVectorTileContent> {
    public constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<IVectorTileContent> = null, metrics?: ITileMetrics) {
        super(x, y, levelOfDetail, data, metrics);
    }
}
