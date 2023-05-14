import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { AbstractDisplayMap, IDisplay } from "./map";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle } from "../geometry/geometry.interfaces";
export declare class CanvasDisplay implements IDisplay {
    canvas: HTMLCanvasElement;
    constructor(canvas: HTMLCanvasElement);
    getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null;
    get height(): number;
    get width(): number;
    resizeToDisplaySize(): boolean;
}
export declare class CanvasTileMap extends AbstractDisplayMap<HTMLImageElement, CanvasDisplay> {
    _observer: ResizeObserver;
    constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<HTMLImageElement, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number);
    protected onDeleted(key: string, tile: ITile<HTMLImageElement>): void;
    protected onAdded(key: string, tile: ITile<HTMLImageElement>): void;
    protected invalidateTiles(added: ITile<HTMLImageElement>[] | undefined, removed: ITile<HTMLImageElement>[] | undefined): void;
    protected invalidateDisplay(rect?: IRectangle): void;
    private invalidate;
}
