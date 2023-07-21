import { ITile, ITileAddress, ITileDatasource } from "../../tiles/tiles.interfaces";
import { AbstractDisplayMap } from "../map";
import { IGeo2 } from "../../geography/geography.interfaces";
import { IRectangle } from "../../geometry/geometry.interfaces";
import { CanvasDisplay } from "./map.canvas.display";
import { RGBAColor } from "../../math/math.color";
type CanvasTileContentType = HTMLImageElement;
type FillRectFn = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
export declare class CanvasTileMapOptions {
    static DefaultBackColor: RGBAColor;
    static DefaultForeColor: RGBAColor;
    static Default: CanvasTileMapOptions;
    backColor?: RGBAColor;
    foreColor?: RGBAColor;
    fillEmpty?: FillRectFn;
    constructor(p: Partial<CanvasTileMapOptions>);
}
export declare class CanvasTileMapOptionsBuilder {
    private _backColor?;
    private _foreColor?;
    _fillEmpty?: FillRectFn;
    withBackColor(v: RGBAColor | number, g?: number, b?: number): CanvasTileMapOptionsBuilder;
    withForeColor(v: RGBAColor | number, g?: number, b?: number): CanvasTileMapOptionsBuilder;
    withFillEmptyFn(v: FillRectFn): CanvasTileMapOptionsBuilder;
    build(): CanvasTileMapOptions;
}
export declare class CanvasTileMap extends AbstractDisplayMap<CanvasTileContentType, ITile<CanvasTileContentType>, CanvasDisplay> {
    _observer: ResizeObserver;
    _options: CanvasTileMapOptions;
    constructor(canvas: HTMLCanvasElement, datasource: ITileDatasource<CanvasTileContentType, ITileAddress>, center?: IGeo2, lod?: number, options?: CanvasTileMapOptions);
    protected onDeleted(key: string, tile: ITile<CanvasTileContentType>): void;
    protected onAdded(key: string, tile: ITile<CanvasTileContentType>): void;
    protected onUpdated(key: string, tile: ITile<CanvasTileContentType>): void;
    protected invalidateTiles(added: ITile<CanvasTileContentType>[] | undefined, removed: ITile<CanvasTileContentType>[] | undefined): void;
    protected invalidateDisplay(rect?: IRectangle): void;
    private invalidate;
}
export {};
