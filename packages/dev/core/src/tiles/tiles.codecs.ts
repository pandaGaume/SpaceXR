import { ITileCodec } from "./tiles.interfaces";
import { Nullable } from "../types";

export class BlobTileCodec implements ITileCodec<Blob> {
    public static Shared = new BlobTileCodec();

    public async decode(r: void | Response): Promise<Nullable<Awaited<Blob>>> {
        if (r instanceof Response) {
            const data = await r.blob();
            return data ;
        }
        return null;
    }
}

export class TextTileCodec implements ITileCodec<string> {
    public static Shared = new TextTileCodec();

    async decode(r: void | Response): Promise<Nullable<Awaited<string>>> {
        if (r instanceof Response) {
            const data = await r.text();
            return data ;
        }
        return null;
    }
}

export class JsonTileCodec implements ITileCodec<object> {
    public static Shared = new JsonTileCodec();

    async decode(r: void | Response): Promise<Nullable<Awaited<object>>> {
        if (r instanceof Response) {
            const data = await r.json();
            return data;
        }
        return null;
    }
}

export class XmlDocumentTileCodec implements ITileCodec<XMLDocument> {
    public static Shared = new XmlDocumentTileCodec();

    async decode(r: void | Response): Promise<Nullable<XMLDocument>> {
        const str = r instanceof Response ? await r.text() : null;
        if (str) {
            const data = new DOMParser().parseFromString(str, "application/xml");
            return data ;
        }
        return null;
    }
}
