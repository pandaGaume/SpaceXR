import { Box } from "../geometry/geometry.box";
import { ITile, ITileDirectory } from "../tiles/tiles.interfaces";
import { AbstractTileMap, IDisplay } from "./map";

export class HologramDisplay extends Box implements IDisplay {}

export class HologramTileMap<T> extends AbstractTileMap<T, HologramDisplay> {
    public constructor(display: HologramDisplay, directory?: ITileDirectory<ITile<T>>, lat?: number, lon?: number, zoom?: number) {
        super(display, directory, lat, lon, zoom);
    }
    public onDeleted(key: string, tile: ITile<T>): void {}
    public onAdded(key: string, tile: ITile<T>): void {}
    public draw(clear: boolean, tiles?: Array<ITile<T>>): void {}
}
