import { IGeo2 } from "../geography/geography.interfaces";
import { ITileDirectory } from "../tiles/tiles.interfaces";
import { View2 } from "../tiles/tiles.view";
export declare class CanvasMap {
    _canvas: HTMLCanvasElement;
    _view: View2<HTMLImageElement>;
    _directory: ITileDirectory<HTMLImageElement>;
    constructor(canvas: HTMLCanvasElement, directory: ITileDirectory<HTMLImageElement>, lat?: number, lon?: number, zoom?: number);
    invalidateSize(w: number, h: number): void;
    setView(center: IGeo2, zoom?: number): void;
    setZoom(zoom: number): void;
    private draw;
}
