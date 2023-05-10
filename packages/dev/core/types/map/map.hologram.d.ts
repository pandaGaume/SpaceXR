import { ITile, ITileDirectory } from "../tiles/tiles.interfaces";
import { AbstractTileMap, IDisplay } from "./map";
export declare class HologramTileMap<T, D extends IDisplay> extends AbstractTileMap<T, D> {
    constructor(display: D, directory?: ITileDirectory<T>, lat?: number, lon?: number, zoom?: number);
    onDeleted(key: string, tile: ITile<T>): void;
    onAdded(key: string, tile: ITile<T>): void;
    draw(clear: boolean, tiles?: Array<ITile<T>>): void;
}
