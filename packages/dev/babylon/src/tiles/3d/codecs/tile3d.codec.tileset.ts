import { ICodec } from "core/tiles/codecs/tiles.codecs.interfaces";
import { ITileset } from "../interfaces";
import { Nullable } from "core/types";

export class TilesetCodec implements ICodec<ITileset> {
    public async decodeAsync(r: void | Response): Promise<Nullable<ITileset>> {
        if (r instanceof Response) {
            const b: ITileset = await r.json();
            return b;
        }
        return null;
    }
}
