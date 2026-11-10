import { describe, expect, it } from "vitest";

import {
    TileHttpClient,
    TileHttpError,
    TileUrlTemplateError,
    WebMercatorTileMetrics,
    WebTileSource,
    expandTileUrlTemplate,
    tileUrlTemplateVariables,
    type FetchFunction,
} from "../src";

describe("tile URL templates", () => {
    const address = { lod: 3, x: 3, y: 5 };

    it("expands every built-in variable", () => {
        expect(expandTileUrlTemplate("{z}/{lod}/{level}/{x}/{y}/{-y}/{quadkey}", address)).toBe("3/3/3/3/5/2/213");
    });

    it("picks subdomains deterministically from the tile", () => {
        const options = { subdomains: ["a", "b", "c"] };
        expect(expandTileUrlTemplate("https://{s}.tile/{z}/{x}/{y}.png", address, options)).toBe("https://c.tile/3/3/5.png");
        expect(expandTileUrlTemplate("https://{s}.tile/{z}/{x}/{y}.png", address, options)).toBe("https://c.tile/3/3/5.png");
        expect(expandTileUrlTemplate("https://{s}.tile/{z}/{x}/{y}.png", { lod: 3, x: 3, y: 4 }, options)).toBe("https://b.tile/3/3/4.png");
    });

    it("encodes application variables", () => {
        const url = expandTileUrlTemplate("https://api/{z}/{x}/{y}.{format}?access_token={accessToken}", address, {
            variables: { format: "webp", accessToken: "pk.a b&c" },
        });
        expect(url).toBe("https://api/3/3/5.webp?access_token=pk.a%20b%26c");
        expect(tileUrlTemplateVariables("{z}/{-y}/{accessToken}")).toEqual(["z", "-y", "accessToken"]);
    });

    it("rejects unknown variables, missing subdomains and redefined built-ins", () => {
        expect(() => expandTileUrlTemplate("{z}/{x}/{row}", address)).toThrow(TileUrlTemplateError);
        expect(() => expandTileUrlTemplate("{s}/{z}", address)).toThrow(TileUrlTemplateError);
        expect(() => expandTileUrlTemplate("{z}", address, { variables: { x: 1 } })).toThrow(TileUrlTemplateError);
        expect(() => expandTileUrlTemplate("{z}/{x}/{y}", { lod: 1, x: 2, y: 0 })).toThrow(RangeError);
    });
});

function response(status: number, body = "", headers: Record<string, string> = {}): Response {
    return new Response(status === 204 ? null : body, { status, headers });
}

function scriptedFetch(responses: Array<Response | Error>): { fetch: FetchFunction; calls: Array<{ url: string; init: RequestInit | undefined }> } {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetch: FetchFunction = (url, init) => {
        calls.push({ url, init });
        const next = responses.shift();
        if (!next) throw new Error("Unexpected request.");
        return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    };
    return { fetch, calls };
}

describe("TileHttpClient", () => {
    const delays: number[] = [];
    const sleep = (milliseconds: number): Promise<void> => {
        delays.push(milliseconds);
        return Promise.resolve();
    };

    it("returns bytes and sends configured headers", async () => {
        const { fetch, calls } = scriptedFetch([response(200, "png", { "content-type": "image/png" })]);
        const client = new TileHttpClient({ fetch, headers: { Authorization: "Bearer t" } });
        const result = await client.fetchTile("https://tile");
        expect(result).toMatchObject({ status: "ok", url: "https://tile", contentType: "image/png" });
        expect(new TextDecoder().decode(result.status === "ok" ? result.bytes : undefined)).toBe("png");
        expect(calls[0]!.init?.headers).toEqual({ Authorization: "Bearer t" });
    });

    it("calls the default fetch on the global object, as browsers require", async () => {
        const original = globalThis.fetch;
        // Mimics the browser check that throws "Illegal invocation" when fetch is detached from window.
        globalThis.fetch = function (this: unknown) {
            if (this !== globalThis) return Promise.reject(new TypeError("Illegal invocation"));
            return Promise.resolve(response(200, "png"));
        } as typeof fetch;
        try {
            await expect(new TileHttpClient({ maxAttempts: 1 }).fetchTile("https://tile")).resolves.toMatchObject({ status: "ok" });
        } finally {
            globalThis.fetch = original;
        }
    });

    it("reports missing tiles as absent instead of failing", async () => {
        const { fetch } = scriptedFetch([response(404), response(204)]);
        const client = new TileHttpClient({ fetch });
        await expect(client.fetchTile("https://a")).resolves.toEqual({ status: "absent", url: "https://a", httpStatus: 404 });
        await expect(client.fetchTile("https://b")).resolves.toEqual({ status: "absent", url: "https://b", httpStatus: 204 });
    });

    it("retries transient failures with exponential backoff and Retry-After", async () => {
        delays.length = 0;
        const { fetch, calls } = scriptedFetch([new TypeError("network"), response(503), response(429, "", { "retry-after": "2" }), response(200, "ok")]);
        const client = new TileHttpClient({ fetch, sleep, random: () => 0.5, initialDelayMs: 100 });
        await expect(client.fetchTile("https://tile")).resolves.toMatchObject({ status: "ok" });
        expect(calls).toHaveLength(4);
        expect(delays).toEqual([150, 250, 2000]);
    });

    it("fails immediately on non-retryable statuses and after exhausting attempts", async () => {
        const forbidden = new TileHttpClient({ fetch: scriptedFetch([response(403)]).fetch, sleep });
        await expect(forbidden.fetchTile("https://tile")).rejects.toMatchObject({ name: "TileHttpError", httpStatus: 403, attempts: 1 });

        const unavailable = new TileHttpClient({ fetch: scriptedFetch([response(500), response(500)]).fetch, sleep, maxAttempts: 2 });
        const error = await unavailable.fetchTile("https://tile").catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(TileHttpError);
        expect(error).toMatchObject({ httpStatus: 500, attempts: 2 });
    });

    it("stops when the signal aborts, including during a backoff delay", async () => {
        const controller = new AbortController();
        const client = new TileHttpClient({
            fetch: scriptedFetch([response(503), response(200)]).fetch,
            initialDelayMs: 60_000,
        });
        const pending = client.fetchTile("https://tile", controller.signal);
        setTimeout(() => controller.abort(new Error("cancelled")), 10);
        await expect(pending).rejects.toThrow("cancelled");
    });
});

describe("WebTileSource", () => {
    it("serves only its levels and validates its template at construction", () => {
        const metrics = new WebMercatorTileMetrics({ minLOD: 2, maxLOD: 4 });
        const source = new WebTileSource({
            registration: "area",
            urlTemplate: "https://{s}.t/{quadkey}",
            subdomains: ["0", "1"],
            metrics,
            client: { fetch: scriptedFetch([]).fetch },
        });
        expect(source.urlOf({ lod: 3, x: 3, y: 5 })).toBe("https://0.t/213");
        expect(() => source.urlOf({ lod: 5, x: 0, y: 0 })).toThrow(RangeError);
        expect(() => new WebTileSource({ registration: "area", urlTemplate: "https://t/{zoom}", metrics, client: { fetch: scriptedFetch([]).fetch } })).toThrow(
            TileUrlTemplateError
        );
    });

    it.each([undefined, "pixel"])("rejects the registration %s", (registration) => {
        const options = { urlTemplate: "https://t/{z}/{x}/{y}", metrics: new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 4 }), client: { fetch: scriptedFetch([]).fetch } };
        expect(() => new WebTileSource({ ...options, registration: registration as never })).toThrow(TypeError);
        expect(new WebTileSource({ ...options, registration: "point" }).registration).toBe("point");
    });
});
