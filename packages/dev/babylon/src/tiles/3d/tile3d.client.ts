import { ITileClient } from "core/tiles";

import { IUrlBuilder, WebClient, WebClientOptions } from "core/io";

import { ITileset } from "./interfaces";
import { TilesetCodec } from "./codecs";
import { ITile3DAddress } from "./tile3d.interfaces";

export class Tile3dWebClient extends WebClient<ITile3DAddress, ITileset> implements ITileClient<ITileset> {
    public constructor(name: string, urlFactory?: IUrlBuilder<ITile3DAddress>, options?: WebClientOptions) {
        super(name, new TilesetCodec(), urlFactory, options);
    }
}
