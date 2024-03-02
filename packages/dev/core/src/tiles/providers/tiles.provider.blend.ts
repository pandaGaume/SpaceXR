import { ITile } from "../tiles.interfaces";
import { AbstractTileProvider } from "./tiles.provider";

export class BlendProvider extends AbstractTileProvider<HTMLImageElement> {
    public _fetchContent(tile: ITile<HTMLImageElement>, callback: (t: ITile<HTMLImageElement>) => void): ITile<HTMLImageElement> {
        throw new Error("Method not implemented.");
    }
}
