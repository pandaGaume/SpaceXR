import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "./map";
import { IGeo2 } from "../geography/geography.interfaces";
import { IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { IDisplay } from "./map";
export declare class CanvasDisplay implements IDisplay {
    canvas: HTMLCanvasElement;
    constructor(canvas: HTMLCanvasElement);
    getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null;
    get height(): number;
    get width(): number;
    equals(other: ISize2): boolean;
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
