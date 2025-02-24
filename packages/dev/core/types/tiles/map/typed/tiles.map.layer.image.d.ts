import { ITile, ITileAddress2, ITileContentProvider, ITileDatasource } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions, ImageLayerContentType } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
export declare class ImageLayer extends TileMapLayer<ImageLayerContentType> implements IImageTileMapLayer {
    constructor(name: string, provider: ITileContentProvider<ImageLayerContentType> | ITileDatasource<ImageLayerContentType, ITileAddress2>, options?: IImageTileMapLayerOptions, enabled?: boolean);
    protected _renderTile(ctx: CanvasRenderingContext2D, tile: ITile<ImageLayerContentType>, w: number, h: number): void;
}
