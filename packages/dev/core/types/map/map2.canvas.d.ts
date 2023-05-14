import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "./map2";
import { CanvasDisplay } from "./map.canvas";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
export declare class CanvasTileMap2 extends AbstractDisplayMap<HTMLImageElement, CanvasDisplay> {
    _observer: ResizeObserver;
    constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<HTMLImageElement, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number);
    onDeleted(key: string, tile: ITile<HTMLImageElement>): void;
    onAdded(key: string, tile: ITile<HTMLImageElement>): void;
    invalidateTiles(added: ITile<HTMLImageElement>[] | undefined, removed: ITile<HTMLImageElement>[] | undefined): void;
    invalidateDisplay(rect?: IRectangle): void;
    private invalidate;
}
