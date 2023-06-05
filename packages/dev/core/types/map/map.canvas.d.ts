import { ITile, ITileAddress, ITileDatasource } from "../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "./map";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
import { CanvasDisplay } from "./map.canvas.display";
export declare class CanvasTileMap extends AbstractDisplayMap<HTMLImageElement, ITile<HTMLImageElement>, CanvasDisplay> {
    _observer: ResizeObserver;
    constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<HTMLImageElement, ITileAddress>, center?: IGeo2, lod?: number);
    protected onDeleted(key: string, tile: ITile<HTMLImageElement>): void;
    protected onAdded(key: string, tile: ITile<HTMLImageElement>): void;
    protected invalidateTiles(added: ITile<HTMLImageElement>[] | undefined, removed: ITile<HTMLImageElement>[] | undefined): void;
    protected invalidateDisplay(rect?: IRectangle): void;
    private invalidate;
}
