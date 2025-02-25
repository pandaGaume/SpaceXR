import { Nullable } from "../../types";
import { ICodec } from "./tiles.codecs.interfaces";
export declare class BlobTileCodec implements ICodec<Blob> {
    static Shared: BlobTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<Blob>>>;
}
export declare class TextTileCodec implements ICodec<string> {
    static Shared: TextTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<string>>>;
}
export declare class JsonTileCodec implements ICodec<object> {
    static Shared: JsonTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<object>>>;
}
export declare class XmlDocumentTileCodec implements ICodec<XMLDocument> {
    static Shared: XmlDocumentTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<Nullable<XMLDocument>>>;
}
