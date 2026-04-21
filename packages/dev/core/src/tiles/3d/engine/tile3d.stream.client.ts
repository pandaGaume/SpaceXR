import { ITileset } from "../interfaces";
import { TilesetCodec } from "../codecs";
import { WebClient, WebClientOptions } from "../../../io";

export class TilesetClient extends WebClient<string, ITileset> {
    public constructor(name: string, options?: WebClientOptions) {
        super(name, TilesetCodec.Shared, undefined, options);
    }
}
