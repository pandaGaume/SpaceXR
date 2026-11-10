const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_HEADER_BYTES = 12;
const GLB_CHUNK_HEADER_BYTES = 8;

interface IGltfAsset {
    copyright?: unknown;
}

interface IGltfDocument {
    asset?: IGltfAsset;
}

function splitCopyright(text: string): readonly string[] {
    try {
        const document = JSON.parse(text) as IGltfDocument;
        if (typeof document.asset?.copyright !== "string") return [];
        return document.asset.copyright
            .split(";")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
    } catch {
        return [];
    }
}

function decodeUtf8(bytes: Uint8Array): string | undefined {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replaceAll(String.fromCharCode(0), "").trim();
    } catch {
        return undefined;
    }
}

/**
 * Extracts the semicolon-separated data attributions of a glTF asset, binary or JSON. Malformed input yields no
 * attribution.
 */
export function extractGltfCopyrights(buffer: ArrayBuffer): readonly string[] {
    if (buffer.byteLength < GLB_HEADER_BYTES) return [];
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== GLB_MAGIC) {
        const text = decodeUtf8(new Uint8Array(buffer));
        return text === undefined ? [] : splitCopyright(text);
    }

    const declaredLength = view.getUint32(8, true);
    const maximumLength = Math.min(declaredLength, buffer.byteLength);
    let offset = GLB_HEADER_BYTES;
    while (offset + GLB_CHUNK_HEADER_BYTES <= maximumLength) {
        const chunkLength = view.getUint32(offset, true);
        const chunkType = view.getUint32(offset + 4, true);
        const chunkStart = offset + GLB_CHUNK_HEADER_BYTES;
        const chunkEnd = chunkStart + chunkLength;
        if (chunkEnd > maximumLength) return [];
        if (chunkType === GLB_JSON_CHUNK) {
            const text = decodeUtf8(new Uint8Array(buffer, chunkStart, chunkLength));
            return text === undefined ? [] : splitCopyright(text);
        }
        offset = chunkEnd;
    }
    return [];
}
