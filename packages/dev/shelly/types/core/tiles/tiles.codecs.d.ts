import { ITile, ITileCodec } from "./tiles.interfaces";
import { Nullable } from "../../types";
export declare class BlobTileCodec implements ITileCodec<Blob> {
    static Shared: BlobTileCodec;
    decode(r: void | Response): Promise<Nullable<Awaited<ITile<Blob>>>>;
}
export declare class TextTileCodec implements ITileCodec<string> {
    static Shared: TextTileCodec;
    decode(r: void | Response): Promise<Nullable<Awaited<ITile<string>>>>;
}
export declare class JsonTileCodec implements ITileCodec<object> {
    static Shared: JsonTileCodec;
    decode(r: void | Response): Promise<Nullable<Awaited<ITile<object>>>>;
}
export declare class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    static Shared: ImageTileCodec;
    decode(r: void | Response): Promise<Nullable<Awaited<ITile<HTMLImageElement>>>>;
}
export declare class XmlDocumentTileCodec implements ITileCodec<XMLDocument> {
    static Shared: XmlDocumentTileCodec;
    decode(r: void | Response): Promise<Nullable<ITile<XMLDocument>>>;
}
