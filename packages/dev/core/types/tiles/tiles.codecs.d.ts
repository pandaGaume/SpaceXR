import { ITileCodec } from "./tiles.interfaces";
import { Nullable } from "../types";
export declare class BlobTileCodec implements ITileCodec<Blob> {
    static Shared: BlobTileCodec;
    decode(r: void | Response): Promise<Nullable<Awaited<Blob>>>;
}
export declare class TextTileCodec implements ITileCodec<string> {
    static Shared: TextTileCodec;
    decode(r: void | Response): Promise<Nullable<Awaited<string>>>;
}
export declare class JsonTileCodec implements ITileCodec<object> {
    static Shared: JsonTileCodec;
    decode(r: void | Response): Promise<Nullable<Awaited<object>>>;
}
export declare class XmlDocumentTileCodec implements ITileCodec<XMLDocument> {
    static Shared: XmlDocumentTileCodec;
    decode(r: void | Response): Promise<Nullable<XMLDocument>>;
}
