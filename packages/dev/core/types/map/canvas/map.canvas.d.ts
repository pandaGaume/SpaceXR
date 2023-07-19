import { ITile, ITileAddress, ITileDatasource } from "../../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "../map";
import { IGeo2 } from "../../geography/geography.interfaces";
import { IRectangle } from "../../geometry/geometry.interfaces";
import { CanvasDisplay } from "./map.canvas.display";
type CanvasTileContentType = HTMLImageElement;
export declare class CanvasTileMap extends AbstractDisplayMap<CanvasTileContentType, ITile<CanvasTileContentType>, CanvasDisplay> {
    _observer: ResizeObserver;
    constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<CanvasTileContentType, ITileAddress>, center?: IGeo2, lod?: number);
    protected onDeleted(key: string, tile: ITile<CanvasTileContentType>): void;
    protected onAdded(key: string, tile: ITile<CanvasTileContentType>): void;
    protected invalidateTiles(added: ITile<CanvasTileContentType>[] | undefined, removed: ITile<CanvasTileContentType>[] | undefined): void;
    protected invalidateDisplay(rect?: IRectangle): void;
    private invalidate;
}
export {};
