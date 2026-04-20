import { ITile, ITile2DAddress, ITileContentFetcher, ITileDatasource } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions, ImageLayerContentType } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
export declare class ImageLayer extends TileMapLayer<ImageLayerContentType> implements IImageTileMapLayer {
    constructor(name: string, provider: ITileContentFetcher<ImageLayerContentType> | ITileDatasource<ImageLayerContentType, ITile2DAddress>, options?: IImageTileMapLayerOptions, enabled?: boolean);
    protected _renderTile(ctx: CanvasRenderingContext2D, tile: ITile<ImageLayerContentType>, w: number, h: number): void;
}
