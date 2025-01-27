import { ITile, ITileBuilder, ITileContentProvider, TileConstructor } from "../tiles.interfaces";
import { AbstractTileProvider } from "./tiles.provider.abstract";
export declare class TileProvider<T> extends AbstractTileProvider<T> {
    _contentProvider: ITileContentProvider<T>;
    constructor(provider: ITileContentProvider<T>, factory?: ITileBuilder<T> | TileConstructor<T>, enabled?: boolean);
    _fetchContent(tile: ITile<T>, callback: (t: ITile<T>) => void): ITile<T>;
}
