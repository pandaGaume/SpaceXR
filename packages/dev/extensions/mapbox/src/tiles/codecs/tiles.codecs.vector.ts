import { VectorTile } from "@mapbox/vector-tile";
import Protobuf from "pbf";
import { Nullable } from "core/types";
import { ICodec } from "core/tiles/codecs/tiles.codecs.interfaces";

export class VectorTileCodec implements ICodec<VectorTile> {
    public async decodeAsync(r: void | Response): Promise<Nullable<VectorTile>> {
        if (r instanceof Response) {
            const b = await r.blob();
            if (b) {
                return new VectorTile(new Protobuf(await b.arrayBuffer()));
            }
        }
        return null;
    }
}
