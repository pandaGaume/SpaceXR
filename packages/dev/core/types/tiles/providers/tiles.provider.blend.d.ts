import { ITile } from "../tiles.interfaces";
import { AbstractTileProvider } from "./tiles.provider";
export declare class BlendProvider extends AbstractTileProvider<HTMLImageElement> {
    _fetchContent(tile: ITile<HTMLImageElement>, callback: (t: ITile<HTMLImageElement>) => void): ITile<HTMLImageElement>;
}
