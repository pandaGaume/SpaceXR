import { ITile, ITileDirectory } from "../tiles/tiles.interfaces";
import { AbstractTileMap, IDisplay } from "./map";
import { ISize2 } from "../geometry/geometry.interfaces";
export declare class CanvasDisplay implements IDisplay {
    canvas: HTMLCanvasElement;
    constructor(canvas: HTMLCanvasElement);
    getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null;
    get height(): number;
    get width(): number;
    equals(other: ISize2): boolean;
}
export declare class CanvasTileMap extends AbstractTileMap<HTMLImageElement, CanvasDisplay> {
    constructor(canvas: HTMLCanvasElement, directory?: ITileDirectory<HTMLImageElement>, lat?: number, lon?: number, zoom?: number);
    onDeleted(key: string, tile: ITile<HTMLImageElement>): void;
    onAdded(key: string, tile: ITile<HTMLImageElement>): void;
    draw(clear?: boolean, tiles?: Array<ITile<HTMLImageElement>>): void;
}
