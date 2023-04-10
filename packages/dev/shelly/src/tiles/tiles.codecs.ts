import { ITile, ITileCodec } from "./tiles.interfaces";
import { Nullable } from "../types";

export class BlobTileCodec implements ITileCodec<Blob> {
    public static Shared = new BlobTileCodec();

    public async decode(r: void | Response): Promise<Nullable<Awaited<ITile<Blob>>>> {
        if (r instanceof Response) {
            const data = await r.blob();
            return <ITile<Blob>>{ data: data };
        }
        return null;
    }
}

export class TextTileCodec implements ITileCodec<string> {
    public static Shared = new TextTileCodec();

    async decode(r: void | Response): Promise<Nullable<Awaited<ITile<string>>>> {
        if (r instanceof Response) {
            const data = await r.text();
            return <ITile<string>>{ data: data };
        }
        return null;
    }
}

export class JsonTileCodec implements ITileCodec<object> {
    public static Shared = new JsonTileCodec();

    async decode(r: void | Response): Promise<Nullable<Awaited<ITile<object>>>> {
        if (r instanceof Response) {
            const data = await r.json();
            return <ITile<object>>{ data: data };
        }
        return null;
    }
}

export class XmlDocumentTileCodec implements ITileCodec<XMLDocument> {
    public static Shared = new XmlDocumentTileCodec();

    async decode(r: void | Response): Promise<Nullable<ITile<XMLDocument>>> {
        const str = r instanceof Response ? await r.text() : null;
        if (str) {
            const data = new DOMParser().parseFromString(str, "application/xml");
            return <ITile<XMLDocument>>{ data: data };
        }
        return null;
    }
}
