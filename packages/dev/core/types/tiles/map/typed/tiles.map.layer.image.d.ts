import { ITile, ITileAddress, ITileDatasource, ITileProvider } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions, ImageLayerContentType } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
export declare class ImageLayer extends TileMapLayer<ImageLayerContentType> implements IImageTileMapLayer {
    constructor(name: string, provider: ITileProvider<ImageLayerContentType> | ITileDatasource<ImageLayerContentType, ITileAddress>, options?: IImageTileMapLayerOptions, enabled?: boolean);
    protected _renderTile(ctx: CanvasRenderingContext2D, tile: ITile<ImageLayerContentType>, w: number, h: number): void;
}
