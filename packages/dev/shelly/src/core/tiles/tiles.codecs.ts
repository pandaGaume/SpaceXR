import { ITile, ITileCodec } from "./tiles.interfaces";
import { Nullable } from "../../types";

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

export class ImageTileCodec implements ITileCodec<HTMLImageElement> {
    public static Shared = new ImageTileCodec();

    async decode(r: void | Response): Promise<Nullable<Awaited<ITile<HTMLImageElement>>>> {
        const blob = r instanceof Response ? await r.blob() : null;
        if (blob) {
            const img: HTMLImageElement = new Image();
            const blobURL: string = URL.createObjectURL(blob);
            // this frees up memory, which is usually handled automatically when you close the
            // page or navigate away from it
            img.onload = function (ev: Event) {
                const e: HTMLImageElement = ev.target as HTMLImageElement;
                URL.revokeObjectURL(e.src);
                e.onload = null;
            };
            img.src = blobURL;
            return <ITile<HTMLImageElement>>{ data: img };
        } else {
            return null;
        }
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
