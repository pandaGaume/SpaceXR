import { ITileAddress3, ITileClient } from "core/tiles";

import { IUrlBuilder, WebClient, WebClientOptions } from "core/io";

import { ITileset } from "./interfaces";
import { TilesetCodec } from "./codecs";

export class Tile3dWebClient extends WebClient<ITileAddress3, ITileset> implements ITileClient<ITileset> {
    public constructor(name: string, urlFactory?: IUrlBuilder<ITileAddress3>, options?: WebClientOptions) {
        super(name, new TilesetCodec(), urlFactory, options);
    }
}
