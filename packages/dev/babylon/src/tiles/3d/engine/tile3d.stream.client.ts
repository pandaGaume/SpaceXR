import { WebClient, WebClientOptions } from "core/io";
import { ITileset } from "../interfaces";
import { TilesetCodec } from "../codecs";

export class TilesetClient extends WebClient<string, ITileset> {
    public constructor(name: string, options?: WebClientOptions) {
        super(name, TilesetCodec.Shared, undefined, options);
    }
}
