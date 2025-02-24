import { ITile, ITileAddress2, ITileContentProvider, ITileDatasource } from "../../tiles.interfaces";
import { IVectorTileContent, TileVectorRenderer } from "../../vector";
import { IVectorStyle } from "../../vector/tiles.vector.style.interface";
import { ITileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";

export interface ITleMapVectorOptions extends ITileMapLayerOptions<IVectorTileContent> {
    style: TileVectorRenderer | IVectorStyle;
}

export class TileMapVectorLayer extends TileMapLayer<IVectorTileContent> {
    _renderer: TileVectorRenderer;

    public constructor(
        name: string,
        source: ITileContentProvider<IVectorTileContent> | ITileDatasource<IVectorTileContent, ITileAddress2>,
        options: ITleMapVectorOptions,
        enabled: boolean = true
    ) {
        super(name, source, options, enabled);
        if (options.style instanceof TileVectorRenderer) {
            this._renderer = options.style;
        } else {
            this._renderer = new TileVectorRenderer(options.style);
        }
        this._draw = this._draw ?? this._renderTile.bind(this);
    }

    protected _renderTile(ctx: CanvasRenderingContext2D, tile: ITile<IVectorTileContent>, w: number, h: number): void {
        this._clip(ctx, 0, 0, w, h);
        this._renderer.renderTile(tile.content!, ctx, w, h);
    }

    protected _clip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
    }
}
