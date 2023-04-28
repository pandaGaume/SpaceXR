import { ITileCodec } from "./tiles.interfaces";
export declare class BlobTileCodec implements ITileCodec<Blob> {
    static Shared: BlobTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<Blob> | undefined>;
}
export declare class TextTileCodec implements ITileCodec<string> {
    static Shared: TextTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<string> | undefined>;
}
export declare class JsonTileCodec implements ITileCodec<object> {
    static Shared: JsonTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<object> | undefined>;
}
export declare class XmlDocumentTileCodec implements ITileCodec<XMLDocument> {
    static Shared: XmlDocumentTileCodec;
    decodeAsync(r: void | Response): Promise<Awaited<XMLDocument> | undefined>;
}
