import { ITileCodec, Nullable } from "./tiles.interfaces";

export class KnownTileCodecs {
    public static Blob: ITileCodec<Blob> = async function (r: void | Response): Promise<Nullable<Awaited<Blob>>> {
        return r instanceof Response ? r.blob() : null;
    };

    public static Text: ITileCodec<string> = async function (r: void | Response): Promise<Nullable<Awaited<string>>> {
        return r instanceof Response ? r.text() : null;
    };

    public static Json: ITileCodec<object> = async function (r: void | Response): Promise<Nullable<Awaited<object>>> {
        return r instanceof Response ? r.json() : null;
    };

    public static Image: ITileCodec<HTMLImageElement> = async function (r: void | Response): Promise<Nullable<Awaited<HTMLImageElement>>> {
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
            return img;
        } else {
            return null;
        }
    };

    public static XmlDocument: ITileCodec<XMLDocument> = async function (r: void | Response): Promise<Nullable<XMLDocument>> {
        const str = r instanceof Response ? await r.text() : null;
        if (str) {
            return new DOMParser().parseFromString(str, "application/xml");
        } else {
            return null;
        }
    };
}
