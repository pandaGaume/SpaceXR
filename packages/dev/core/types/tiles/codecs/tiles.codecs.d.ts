import { Nullable } from "../../types";
import { ITileCodec } from "../tiles.interfaces";
export declare class BlobTileCodec implements ITileCodec<Blob> {
    static Shared: BlobTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<Blob>>>;
}
export declare class TextTileCodec implements ITileCodec<string> {
    static Shared: TextTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<string>>>;
}
export declare class JsonTileCodec implements ITileCodec<object> {
    static Shared: JsonTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<object>>>;
}
export declare class XmlDocumentTileCodec implements ITileCodec<XMLDocument> {
    static Shared: XmlDocumentTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<XMLDocument>>>;
}
