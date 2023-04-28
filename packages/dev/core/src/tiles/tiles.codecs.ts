import { ITileCodec } from "./tiles.interfaces";

export class BlobTileCodec implements ITileCodec<Blob> {
    public static Shared = new BlobTileCodec();

    public async decodeAsync(r: void | Response): Promise<Awaited<Blob> | undefined> {
        if (r instanceof Response) {
            const data = await r.blob();
            return data;
        }
        return undefined;
    }
}

export class TextTileCodec implements ITileCodec<string> {
    public static Shared = new TextTileCodec();

    async decodeAsync(r: void | Response): Promise<Awaited<string> | undefined> {
        if (r instanceof Response) {
            const data = await r.text();
            return data;
        }
        return undefined;
    }
}

export class JsonTileCodec implements ITileCodec<object> {
    public static Shared = new JsonTileCodec();

    async decodeAsync(r: void | Response): Promise<Awaited<object> | undefined> {
        if (r instanceof Response) {
            const data = await r.json();
            return data;
        }
        return undefined;
    }
}

export class XmlDocumentTileCodec implements ITileCodec<XMLDocument> {
    public static Shared = new XmlDocumentTileCodec();

    async decodeAsync(r: void | Response): Promise<Awaited<XMLDocument> | undefined> {
        const str = r instanceof Response ? await r.text() : null;
        if (str) {
            const data = new DOMParser().parseFromString(str, "application/xml");
            return data;
        }
        return undefined;
    }
}
