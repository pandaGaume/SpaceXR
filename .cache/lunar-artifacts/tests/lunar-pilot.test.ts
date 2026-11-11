import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { ReferenceSurface, cubeTileDirection, parseCelestialDataset } from "@spacexr/tiles/cube";
import { CelestialTileSource } from "@spacexr/tiles/cube";
import {
    atomicWrite,
    download,
    initializeStorage,
    sha256,
    storagePath,
    withImportLock,
    writeJson,
    type Fetcher,
} from "../tools/lunar/storage";
import { blockRequest, polarSource, type ITrekMetadata } from "../tools/lunar/trek";
import { POLAR_PILOT, rebaseGrid, terrariumPng, verifyPilotBorders, type IPilotManifest } from "../tools/lunar/pilot";
import { assertSourceCoverage, SITE04_PILOT, site04Source } from "../tools/lunar/pgda";
import { createPilotServer } from "../tools/lunar/server";

const roots: string[] = [];
async function temporary(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "lunar-pilot-"));
    roots.push(root);
    return root;
}
afterEach(async () => {
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

function metadata(): ITrekMetadata {
    return {
        pixelType: "F32",
        bandCount: 1,
        pixelSizeX: 5,
        pixelSizeY: 5,
        maxImageWidth: 15000,
        maxImageHeight: 4100,
        extent: {
            xmin: -75840,
            ymin: -75840,
            xmax: 75840,
            ymax: 75840,
            spatialReference: {
                wkt: 'PROJECTION["Stereographic_South_Pole"] SPHEROID["Moon_2000_IAU_IAG",1737400.0,0.0] PARAMETER["central_meridian",0.0] PARAMETER["false_easting",0.0] PARAMETER["false_northing",0.0] PARAMETER["standard_parallel_1",-90.0]',
            },
        },
    };
}

describe("bounded lunar source storage", () => {
    it("excludes concurrent imports and releases the lease after failure", async () => {
        const root = await temporary();
        await initializeStorage(root, 0);
        await expect(
            withImportLock(root, async () => {
                await expect(withImportLock(root, async () => 0)).rejects.toMatchObject({ code: "EEXIST" });
                throw new Error("interrupted import");
            }),
        ).rejects.toThrow("interrupted import");
        expect(await withImportLock(root, async () => 7)).toBe(7);
    });
    it("rejects traversal, absolute paths and Windows separators", () => {
        for (const key of ["../ALOS/data", "/ALOS/data", "C:/ALOS/data", "tiles\\secret", "a/../b"])
            expect(() => storagePath("F:/LunarData", key)).toThrow();
        expect(storagePath("F:/LunarData", "datasets/moon/5/11/1023/1023.png")).toContain("1023.png");
    });
    it("reuses verified bytes and downloads again after local corruption", async () => {
        const root = await temporary(),
            file = join(root, "source.tif"),
            bytes = Buffer.from("NASA fixture");
        const request = vi.fn(async () => new Response(bytes)) as unknown as Fetcher;
        await download("https://example.test/source", file, 100, sha256(bytes), request);
        await download("https://example.test/source", file, 100, sha256(bytes), request);
        expect(request).toHaveBeenCalledTimes(1);
        await writeFile(file, "corrupt");
        await download("https://example.test/source", file, 100, sha256(bytes), request);
        expect(request).toHaveBeenCalledTimes(2);
        expect(await readFile(file)).toEqual(bytes);
    });
    it("resumes only a matching strong ETag and exact byte range", async () => {
        const file = join(await temporary(), "source.tif"),
            url = "https://example.test/source";
        await writeFile(`${file}.part`, "ABC");
        await writeJson(`${file}.part.json`, { url, etag: '"version-1"' });
        const request = vi.fn(async (_url, init) => {
            expect(init?.headers).toMatchObject({ Range: "bytes=3-", "If-Range": '"version-1"' });
            return new Response("DEF", {
                status: 206,
                headers: { etag: '"version-1"', "content-range": "bytes 3-5/6" },
            });
        }) as unknown as Fetcher;
        await download(url, file, 10, sha256(Buffer.from("ABCDEF")), request);
        expect(await readFile(file, "utf8")).toBe("ABCDEF");
    });
    it("keeps HTTP failure and oversize transfers out of the completed cache", async () => {
        const file = join(await temporary(), "source.tif");
        await expect(
            download(
                "https://example.test/source",
                file,
                2,
                undefined,
                vi.fn(async () => new Response("long")) as Fetcher,
            ),
        ).rejects.toThrow("budget");
        await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
        await expect(
            download(
                "https://example.test/source",
                file,
                20,
                undefined,
                vi.fn(async () => new Response("bad", { status: 503 })) as Fetcher,
            ),
        ).rejects.toThrow("503");
    });
});

describe("physical lunar grids", () => {
    it("keeps every regional pilot interpolation footprint inside Site04", () => {
        expect(() => assertSourceCoverage(SITE04_PILOT, site04Source())).not.toThrow();
        expect(() => assertSourceCoverage(POLAR_PILOT, site04Source())).toThrow("coverage");
    });
    it("uses fixed native pixel blocks including the cropped last block", () => {
        const source = polarSource(metadata());
        const block = blockRequest(source.matrix, 29, 29);
        expect(block.bbox).toEqual([-1600, -960, 960, 1600]);
        expect(block.width).toBe(512);
        expect(blockRequest(source.matrix, 59, 59).width).toBe(128);
        expect(() => polarSource({ ...metadata(), pixelType: "U8" })).toThrow();
        expect(() => blockRequest(source.matrix, 60, 0)).toThrow();
    });
    it("preserves physical radius when rebasing onto a flattened target", () => {
        const target = new ReferenceSurface(1738100, 1738100, 1736000);
        const address = { face: 5, lod: 0, x: 0, y: 0 };
        const source = new Float32Array(9).fill(3000);
        const output = rebaseGrid(source, address, target, 2);
        for (let row = 0; row < 3; row++)
            for (let col = 0; col < 3; col++) {
                const d = cubeTileDirection(address, col / 2, row / 2);
                expect(target.radius(d) + output[row * 3 + col]!).toBeCloseTo(1740400, 3);
            }
        expect(output[4]).toBe(4400);
        expect(() => rebaseGrid(new Float32Array(2), address, target, 2)).toThrow();
    });
    it("roundtrips numeric PNG channels, negative heights, carries and NoData", async () => {
        const heights = new Float32Array([-32768, -1.2, 0.9999, NaN]);
        const png = await terrariumPng(heights, 2);
        const image = await sharp(png).ensureAlpha().raw().toBuffer();
        for (let i = 0; i < 3; i++) {
            const k = i * 4;
            const decoded = 256 * image[k]! + image[k + 1]! + image[k + 2]! / 256 - 32768;
            expect(Math.abs(decoded - heights[i]!)).toBeLessThanOrEqual(1 / 512);
            expect(image[k + 3]).toBe(255);
        }
        expect(image[15]).toBe(0);
    });
    it("rejects a mismatched shared edge rather than hiding the seam", () => {
        const grids = Array.from({ length: 4 }, () => new Float32Array(9).fill(17));
        expect(verifyPilotBorders(grids, 2)).toBe(4);
        grids[1]![0] = 18;
        expect(() => verifyPilotBorders(grids, 2)).toThrow("mismatch");
    });
});

describe("local pilot HTTP inventory", () => {
    it("serves only registered revision files with MIME, ETag and bounded descriptor availability", async () => {
        const root = await temporary(),
            revision = "0123456789abcdef0123",
            directory = `datasets/moon/pilot-${revision}`;
        const path = "global-imagery/0/0/0/0.webp",
            bytes = Buffer.from("fixture-webp");
        const manifest: IPilotManifest = {
            schema: "lunar-pilot-result/1",
            revision,
            createdAt: new Date(0).toISOString(),
            configuration: {
                schema: "lunar-pilot/1",
                referenceRadii: [1738100, 1738100, 1738100],
                frame: "MOON_ME",
                scientificStatus: "preview",
            },
            sources: [],
            sharedBordersVerified: 0,
            tiles: [
                {
                    kind: "global-imagery",
                    address: { face: 0, lod: 0, x: 0, y: 0 },
                    path,
                    sha256: sha256(bytes),
                    bytes: bytes.length,
                },
            ],
        };
        await writeJson(storagePath(root, "catalog/latest-pilot.json"), { revision, directory });
        await writeJson(storagePath(root, `${directory}/pilot.json`), manifest);
        await atomicWrite(storagePath(root, `${directory}/${path}`), bytes);
        await writeJson(storagePath(root, `${directory}/imagery.json`), {
            scheme: "spacexr-cube-equiangular/1",
            body: "Moon",
            frame: "MOON_ME",
            referenceRadii: [1738100, 1738100, 1738100],
            content: "imagery",
            encoding: "webp",
            tileSize: 256,
            minLOD: 0,
            maxLOD: 0,
            subtrees: [],
            tiles: "./global-imagery/{face}/{z}/{x}/{y}.webp",
        });
        const server = await createPilotServer(root);
        await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Server not listening");
        const base = `http://127.0.0.1:${address.port}`;
        try {
            const response = await fetch(`${base}/${revision}/${path}`);
            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe("image/webp");
            expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
            expect(
                (
                    await fetch(`${base}/${revision}/${path}`, {
                        headers: { "If-None-Match": response.headers.get("etag")! },
                    })
                ).status,
            ).toBe(304);
            expect((await fetch(`${base}/catalog/lunar-pilot.json`)).status).toBe(404);
            expect((await fetch(`${base}/${revision}/global-imagery/0/11/0/0.webp`)).status).toBe(404);
            expect((await fetch(base, { method: "POST" })).status).toBe(405);
            const descriptor = parseCelestialDataset(await fetch(`${base}/imagery.json`).then((r) => r.json()));
            expect(descriptor.tiles).toContain(`/${revision}/global-imagery/`);
            expect(new CelestialTileSource(descriptor).isAvailable({ face: 5, lod: 11, x: 1023, y: 1023 })).toBe(false);
        } finally {
            await new Promise<void>((accept, reject) => server.close((error) => (error ? reject(error) : accept())));
        }
    });
});
