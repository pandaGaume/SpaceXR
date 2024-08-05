import { VectorTile } from "@mapbox/vector-tile";
import Protobuf from "pbf";
import { ITileCodec } from "core/tiles";
import { Nullable } from "core/types";

export class VectorTileCodec implements ITileCodec<VectorTile> {
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
