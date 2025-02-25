import { Nullable } from "../../types";
import { ICodec } from "./tiles.codecs.interfaces";

export class BlobTileCodec implements ICodec<Blob> {
    public static Shared = new BlobTileCodec();

    public async decodeAsync(r: void | Response): Promise<Awaited<Nullable<Blob>>> {
        if (r instanceof Response) {
            const data = await r.blob();
            return data;
        }
        return null;
    }
}

export class TextTileCodec implements ICodec<string> {
    public static Shared = new TextTileCodec();

    async decodeAsync(r: void | Response): Promise<Awaited<Nullable<string>>> {
        if (r instanceof Response) {
            const data = await r.text();
            return data;
        }
        return null;
    }
}

export class JsonTileCodec implements ICodec<object> {
    public static Shared = new JsonTileCodec();

    async decodeAsync(r: void | Response): Promise<Awaited<Nullable<object>>> {
        if (r instanceof Response) {
            const data = await r.json();
            return data;
        }
        return null;
    }
}

export class XmlDocumentTileCodec implements ICodec<XMLDocument> {
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
