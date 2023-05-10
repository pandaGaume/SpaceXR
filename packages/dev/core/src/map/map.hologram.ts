import { ITile, ITileDirectory } from "../tiles/tiles.interfaces";
import { AbstractTileMap, IDisplay } from "./map";

export class HologramTileMap<T, D extends IDisplay> extends AbstractTileMap<T, D> {
    public constructor(display: D, directory?: ITileDirectory<T>, lat?: number, lon?: number, zoom?: number) {
        super(display, directory, lat, lon, zoom);
    }
    public onDeleted(key: string, tile: ITile<T>): void {}
    public onAdded(key: string, tile: ITile<T>): void {}
    public draw(clear: boolean, tiles?: Array<ITile<T>>): void {}
}
