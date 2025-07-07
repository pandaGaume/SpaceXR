import { ITileContentProvider, ITileMapLayerOptions, TileMapLayer } from "core/tiles";
import { ITileset } from "../tiles";

export class Tile3dLayer<T extends ITileset> extends TileMapLayer<T> {
    public constructor(name: string, provider: ITileContentProvider<T>, options?: ITileMapLayerOptions<ITileset>, enabled?: boolean) {
        super(name, provider, options, enabled);
    }
}
