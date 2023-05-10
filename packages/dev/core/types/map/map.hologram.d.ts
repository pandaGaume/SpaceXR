import { Box } from "../geometry/geometry.box";
import { ITile, ITileDirectory } from "../tiles/tiles.interfaces";
import { AbstractTileMap, IDisplay } from "./map";
export declare class HologramDisplay extends Box implements IDisplay {
}
export declare class HologramTileMap<T> extends AbstractTileMap<T, HologramDisplay> {
    constructor(display: HologramDisplay, directory?: ITileDirectory<T>, lat?: number, lon?: number, zoom?: number);
    onDeleted(key: string, tile: ITile<T>): void;
    onAdded(key: string, tile: ITile<T>): void;
    draw(clear: boolean, tiles?: Array<ITile<T>>): void;
}
