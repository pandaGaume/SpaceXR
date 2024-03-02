import { ICanvasRenderingContext } from "..";
import { ITileAddress, ITileDatasource, ITileProvider } from "../../tiles/tiles.interfaces";
import { ITileMapLayerOptions } from "../../tiles/map/tiles.map.interfaces";
import { TileMapLayer } from "../../tiles/map/tiles.map.layer";
export declare class TileMapImageLayer extends TileMapLayer<HTMLImageElement> {
    constructor(name: string, provider: ITileProvider<HTMLImageElement> | ITileDatasource<HTMLImageElement, ITileAddress>, options?: ITileMapLayerOptions, enabled?: boolean);
    draw(ctx: ICanvasRenderingContext): void;
}
