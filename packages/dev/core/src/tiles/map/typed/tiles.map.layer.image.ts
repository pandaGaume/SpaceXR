import { ITile, ITile2DAddress, ITileContentProvider, ITileDatasource } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions, ImageLayerContentType } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";

export class ImageLayer extends TileMapLayer<ImageLayerContentType> implements IImageTileMapLayer {
    public constructor(
        name: string,
        provider: ITileContentProvider<ImageLayerContentType> | ITileDatasource<ImageLayerContentType, ITile2DAddress>,
        options?: IImageTileMapLayerOptions,
        enabled?: boolean
    ) {
        super(name, provider, options, enabled);
        this._draw = this._draw ?? this._renderTile.bind(this);
    }

    protected _renderTile(ctx: CanvasRenderingContext2D, tile: ITile<ImageLayerContentType>, w: number, h: number): void {
        ctx.drawImage(tile.content!, 0, 0, w + 1, h + 1);
    }
}
