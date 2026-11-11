/** Format of a 3D Tiles content payload, recognized from its bytes. */
export type TileContentFormat = "glb" | "gltf" | "tileset" | "b3dm" | "i3dm" | "pnts" | "cmpt" | "unknown";

const MAGIC_FORMATS: ReadonlyMap<string, TileContentFormat> = new Map([
    ["glTF", "glb"],
    ["b3dm", "b3dm"],
    ["i3dm", "i3dm"],
    ["pnts", "pnts"],
    ["cmpt", "cmpt"],
]);

const OPENING_BRACE = 0x7b;
const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;

function isJsonWhitespace(byte: number): boolean {
    return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
}

function firstJsonByte(bytes: Uint8Array): number {
    let index = bytes[0] === UTF8_BOM[0] && bytes[1] === UTF8_BOM[1] && bytes[2] === UTF8_BOM[2] ? 3 : 0;
    while (index < bytes.length && isJsonWhitespace(bytes[index]!)) index++;
    return index;
}

/**
 * Recognizes a content payload from its bytes rather than from its URI or media type, because 3D Tiles content URIs
 * may omit extensions and servers may report generic media types.
 *
 * A JSON object with a `root` member is a tileset, as required by 3D Tiles; any other JSON object with an `asset`
 * member is a glTF asset.
 */
export function detectTileContentFormat(bytes: Uint8Array): TileContentFormat {
    if (bytes.length >= 4) {
        const magic = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
        const format = MAGIC_FORMATS.get(magic);
        if (format) return format;
    }

    const start = firstJsonByte(bytes);
    if (bytes[start] !== OPENING_BRACE) return "unknown";
    try {
        const document = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start))) as unknown;
        if (typeof document !== "object" || document === null || Array.isArray(document)) return "unknown";
        if ("root" in document) return "tileset";
        if ("asset" in document) return "gltf";
        return "unknown";
    } catch {
        return "unknown";
    }
}
