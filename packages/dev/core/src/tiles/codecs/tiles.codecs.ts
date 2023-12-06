import { Nullable } from "../../types";
import { ITileCodec } from "../tiles.interfaces";

export class BlobTileCodec implements ITileCodec<Blob> {
    public static Shared = new BlobTileCodec();

    public async decodeAsync(r: void | Response): Promise<Awaited<Nullable<Blob>>> {
        if (r instanceof Response) {
            const data = await r.blob();
            return data;
        }
        return null;
    }
}

export class TextTileCodec implements ITileCodec<string> {
    public static Shared = new TextTileCodec();

    async decodeAsync(r: void | Response): Promise<Awaited<Nullable<string>>> {
        if (r instanceof Response) {
            const data = await r.text();
            return data;
        }
        return null;
    }
}

export class JsonTileCodec implements ITileCodec<object> {
    public static Shared = new JsonTileCodec();

    async decodeAsync(r: void | Response): Promise<Awaited<Nullable<object>>> {
        if (r instanceof Response) {
            const data = await r.json();
            return data;
        }
        return null;
    }
}

export class XmlDocumentTileCodec implements ITileCodec<XMLDocument> {
    public static Shared = new XmlDocumentTileCodec();

    async decodeAsync(r: void | Response): Promise<Awaited<Nullable<XMLDocument>>> {
        const str = r instanceof Response ? await r.text() : null;
        if (str) {
            const data = new DOMParser().parseFromString(str, "application/xml");
            return data;
        }
        return null;
    }
}
