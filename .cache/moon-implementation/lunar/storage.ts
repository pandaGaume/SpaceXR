import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, readFile, rename, stat, statfs, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

/** Resolve a portable object key inside a configured storage root. */
export function storagePath(root: string, key: string): string {
    if (
        !key ||
        key.includes("\\") ||
        key.includes(":") ||
        key.split("/").some((part) => !part || part === "." || part === "..")
    )
        throw new Error("Expected a relative storage key");
    const file = resolve(root, key);
    const child = relative(resolve(root), file);
    if (isAbsolute(child) || child.startsWith("..")) throw new Error("Storage key escapes its root");
    return file;
}

/** Hash exact stored bytes; an HTTP ETag is not necessarily a content hash. */
export function sha256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
}

/** Hash arbitrarily large files with a bounded read buffer. */
export async function hashFile(file: string): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest("hex");
}

/** Commit a complete file by rename, leaving an existing result intact on write failure. */
export async function atomicWrite(file: string, bytes: Uint8Array | string): Promise<void> {
    await mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporary, bytes, { flag: "wx" });
        await rename(temporary, file);
    } finally {
        await unlink(temporary).catch(() => undefined);
    }
}

/** Persist a readable receipt alongside data, using the same atomic commit rule. */
export async function writeJson(file: string, value: unknown): Promise<void> {
    await atomicWrite(file, JSON.stringify(value, null, 2) + "\n");
}

/** Create only the lunar directories, checking free space before an import. */
export async function initializeStorage(root: string, reserveBytes = 2 * 1024 ** 3): Promise<number> {
    await mkdir(root, { recursive: true });
    const volume = await statfs(root);
    const free = volume.bavail * volume.bsize;
    if (free < reserveBytes) throw new Error("Insufficient free space for the lunar pilot");
    for (const key of ["sources/moon", "catalog", "cache", "work", "datasets/moon", "reports"])
        await mkdir(storagePath(root, key), { recursive: true });
    return free;
}

/** Serialize imports into a root so two processes cannot append to the same partial file. */
export async function withImportLock<T>(root: string, action: () => Promise<T>): Promise<T> {
    const file = storagePath(root, "work/import.lock");
    const handle = await open(file, "wx");
    try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
        return await action();
    } finally {
        await handle.close();
        await unlink(file);
    }
}

interface IDownloadReceipt {
    url: string;
    bytes: number;
    sha256: string;
    etag?: string;
}

/** Network port used by imports; tests inject a deterministic HTTP implementation. */
export type Fetcher = typeof fetch;

/**
 * Download a bounded source and reuse only checksum-verified completed files.
 * Interrupted transfers resume only with a strong ETag and a matching Content-Range.
 * A changed resource starts again. HTTP failures remain errors, never terrain NoData.
 *
 * @param maxBytes - Hard transfer and memory limit for this individual file.
 * @param expectedHash - Optional pinned SHA-256 of a known product.
 */
export async function download(
    url: string,
    file: string,
    maxBytes: number,
    expectedHash?: string,
    request: Fetcher = fetch,
    options: { timeoutMs?: number; onProgress?: (bytes: number) => void } = {},
): Promise<IDownloadReceipt> {
    const receiptFile = `${file}.json`;
    try {
        const receipt = JSON.parse(await readFile(receiptFile, "utf8")) as IDownloadReceipt;
        const size = (await stat(file)).size;
        if (
            receipt.url === url &&
            size <= maxBytes &&
            receipt.bytes === size &&
            receipt.sha256 === (await hashFile(file)) &&
            (!expectedHash || receipt.sha256 === expectedHash)
        )
            return receipt;
    } catch (error) {
        if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await mkdir(dirname(file), { recursive: true });
    const partial = `${file}.part`;
    let offset = 0;
    let etag: string | undefined;
    try {
        const resume = JSON.parse(await readFile(`${partial}.json`, "utf8")) as { url: string; etag: string };
        const size = (await stat(partial)).size;
        if (resume.url === url && /^"[^\r\n]+"$/.test(resume.etag) && size > 0 && size < maxBytes) {
            offset = size;
            etag = resume.etag;
        }
    } catch (error) {
        if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const response = await request(url, {
        headers: { "Accept-Encoding": "identity", ...(offset ? { Range: `bytes=${offset}-`, "If-Range": etag! } : {}) },
        signal: AbortSignal.timeout(options.timeoutMs ?? 120000),
    });
    if (!response.ok || !response.body) throw new Error(`Source download failed: HTTP ${response.status}`);
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
    if (
        response.status === 206 &&
        (!offset ||
            !range ||
            Number(range[1]) !== offset ||
            response.headers.get("etag") !== etag ||
            Number(range[3]) > maxBytes)
    ) {
        await response.body.cancel();
        throw new Error("Invalid resumed source response");
    }
    if (response.status !== 200 && response.status !== 206) {
        await response.body.cancel();
        throw new Error("Expected a complete or resumed source response");
    }
    if (response.status === 200) offset = 0;
    const declared = Number(response.headers.get("content-length"));
    if (declared > maxBytes - offset) {
        await response.body.cancel();
        throw new Error("Source exceeds its byte budget");
    }
    const currentEtag = response.headers.get("etag") ?? undefined;
    await writeJson(`${partial}.json`, { url, etag: currentEtag });
    const handle = await open(partial, offset ? "a" : "w");
    const reader = response.body.getReader();
    let length = offset;
    try {
        let next = await reader.read();
        while (!next.done) {
            const chunk = next.value;
            length += chunk.byteLength;
            if (length > maxBytes) {
                await reader.cancel();
                throw new Error("Source exceeds its byte budget");
            }
            await handle.writeFile(chunk);
            options.onProgress?.(length);
            next = await reader.read();
        }
    } finally {
        reader.releaseLock();
        await handle.close();
    }
    if (range && response.status === 206 && length !== Number(range[3])) throw new Error("Incomplete resumed source");
    if (response.headers.has("content-length") && length !== offset + declared)
        throw new Error("Incomplete source download");
    const hash = await hashFile(partial);
    if (expectedHash && expectedHash !== hash) throw new Error("NASA source checksum changed");
    await rename(partial, file);
    const receipt = { url, bytes: length, sha256: hash, etag: currentEtag };
    await writeJson(receiptFile, receipt);
    await unlink(`${partial}.json`).catch(() => undefined);
    return receipt;
}
