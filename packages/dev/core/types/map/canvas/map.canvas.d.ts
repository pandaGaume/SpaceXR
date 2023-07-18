import { ITile, ITileAddress, ITileContentView, ITileDatasource } from "../../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "../map";
import { IGeo2 } from "../../geography/geography.interfaces";
import { IRectangle } from "../../geometry/geometry.interfaces";
import { CanvasDisplay } from "./map.canvas.display";
type TileContentType = ITileContentView<HTMLImageElement, IRectangle> | HTMLImageElement;
export declare class CanvasTileMap extends AbstractDisplayMap<TileContentType, ITile<TileContentType>, CanvasDisplay> {
    _observer: ResizeObserver;
    constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<TileContentType, ITileAddress>, center?: IGeo2, lod?: number);
    protected onDeleted(key: string, tile: ITile<TileContentType>): void;
    protected onAdded(key: string, tile: ITile<TileContentType>): void;
    protected invalidateTiles(added: ITile<TileContentType>[] | undefined, removed: ITile<TileContentType>[] | undefined): void;
    protected invalidateDisplay(rect?: IRectangle): void;
    private invalidate;
}
export {};
