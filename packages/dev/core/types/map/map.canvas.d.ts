import { IGeo2 } from "../geography/geography.interfaces";
import { ITile, ITileDirectory } from "../tiles/tiles.interfaces";
import { View2 } from "../tiles/tiles.view";
import { IRectangle } from "../geometry/geometry.interfaces";
import { Cartesian2 } from "../geometry/geometry.cartesian";
export declare class CanvasTileMap {
    _canvas: HTMLCanvasElement;
    _view: View2<HTMLImageElement>;
    _directory?: ITileDirectory<HTMLImageElement>;
    _activ: Map<string, ITile<HTMLImageElement>>;
    _bounds?: IRectangle;
    _scale: Cartesian2;
    _lod: number;
    constructor(canvas: HTMLCanvasElement, directory?: ITileDirectory<HTMLImageElement>, lat?: number, lon?: number, zoom?: number);
    get center(): IGeo2;
    invalidateSize(w?: number, h?: number): void;
    setView(center: IGeo2, zoom?: number): void;
    setZoom(zoom: number): void;
    zoomIn(delta: number): void;
    zoomOut(delta: number): void;
    translate(tx: number, ty: number): void;
    private get metrics();
    private onUpdate;
    private draw;
}
