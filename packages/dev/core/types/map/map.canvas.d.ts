import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { AbstractDisplayMap, IMapDisplay } from "./map";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle, ISize3 } from "../geometry/geometry.interfaces";
export declare class CanvasDisplay implements IMapDisplay {
    canvas: HTMLCanvasElement;
    constructor(canvas: HTMLCanvasElement);
    getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null;
    get resolution(): ISize3;
    resizeToDisplaySize(scale?: number): boolean;
}
export declare class CanvasTileMap extends AbstractDisplayMap<HTMLImageElement, ITile<HTMLImageElement>, CanvasDisplay> {
    _observer: ResizeObserver;
    constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<HTMLImageElement, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number);
    protected onDeleted(key: string, tile: ITile<HTMLImageElement>): void;
    protected onAdded(key: string, tile: ITile<HTMLImageElement>): void;
    protected invalidateTiles(added: ITile<HTMLImageElement>[] | undefined, removed: ITile<HTMLImageElement>[] | undefined): void;
    protected invalidateDisplay(rect?: IRectangle): void;
    private invalidate;
}
