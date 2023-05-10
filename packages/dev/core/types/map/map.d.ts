import { TileMapView } from "../tiles/tiles.view";
import { IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { ITile, ITileDirectory, ITileMetrics, ITileMetricsProvider } from "../tiles/tiles.interfaces";
import { Cartesian2 } from "../geometry/geometry.cartesian";
import { IGeo2 } from "../geography/geography.interfaces";
export interface IDisplay extends ISize2 {
}
export declare abstract class AbstractTileMap<T, D extends IDisplay> implements ITileMetricsProvider {
    _display: D;
    _view: TileMapView;
    _directory?: ITileDirectory<T>;
    _activ: Map<string, ITile<T>>;
    _pixelBounds?: IRectangle;
    _scale: Cartesian2;
    _lod: number;
    constructor(display: D, directory?: ITileDirectory<T>, lat?: number, lon?: number, zoom?: number);
    invalidateSize(w?: number, h?: number): void;
    setView(center: IGeo2, zoom?: number): void;
    setZoom(zoom: number): void;
    zoomIn(delta: number): void;
    zoomOut(delta: number): void;
    translate(tx: number, ty: number): void;
    get metrics(): ITileMetrics;
    private onUpdate;
    abstract onDeleted(key: string, tile: ITile<T>): void;
    abstract onAdded(key: string, tile: ITile<T>): void;
    abstract draw(clear?: boolean, tile?: Array<ITile<T>>): void;
}
