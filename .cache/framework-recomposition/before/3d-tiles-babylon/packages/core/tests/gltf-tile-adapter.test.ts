import type { ContentLoadResult, IEcefSpatialState, ITileActivationContext } from "@spacexr/3d-tiles-runtime";
import { describe, expect, it, vi } from "vitest";

import { BabylonGltfTileAdapter, type IBabylonGltfTileHandle } from "../src";
import { createNullScene, encodeJson } from "./helpers";

type Context = ITileActivationContext<IEcefSpatialState, IBabylonGltfTileHandle, never>;

function createContext(uri: string) {
    const ready = vi.fn(async (_contentId: string, _result: ContentLoadResult<IBabylonGltfTileHandle>) => true);
    const failed = vi.fn(async (_contentId: string, _error: unknown) => undefined);
    const cancelled = vi.fn(async (_contentId: string) => undefined);
    const controller = new AbortController();
    const context = {
        pendingContents: [{ id: "content-0", uri }],
        signal: controller.signal,
        tile: { spatial: { worldTransform: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), geometricError: 0 } },
        readiness: { ready, failed, cancelled },
    } as unknown as Context;
    return { context, ready, failed, cancelled, controller };
}

function respond(body: Uint8Array<ArrayBuffer>, init: ResponseInit = {}, url?: string) {
    return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
        const response = new Response(body, init);
        if (url) Object.defineProperty(response, "url", { value: url });
        return response;
    });
}

const EXTERNAL_TILESET = {
    asset: { version: "1.1" },
    geometricError: 10,
    root: { boundingVolume: { sphere: [0, 0, 0, 1] }, geometricError: 0, refine: "REPLACE" },
};

describe("BabylonGltfTileAdapter", () => {
    it("grafts an extensionless JSON tileset as an external tileset", async () => {
        const fetch = respond(
            encodeJson(EXTERNAL_TILESET),
            { headers: { "content-type": "application/octet-stream" } },
            "https://example.test/tiles/next",
        );
        const adapter = new BabylonGltfTileAdapter(createNullScene(), { fetch });
        const { context, ready, failed } = createContext("https://example.test/tiles/next");

        await adapter.activate(context);

        expect(failed).not.toHaveBeenCalled();
        const result = ready.mock.calls[0]![1];
        expect(result.kind).toBe("external-tileset");
        if (result.kind !== "external-tileset") return;
        expect(result.tileset.geometricError).toBe(10);
        expect(result.documentUri).toBe("https://example.test/tiles/next");
        expect(result.baseUri).toBe("https://example.test/tiles/");
        expect(new Headers(fetch.mock.calls[0]![1]!.headers).get("Accept")).toContain("model/gltf-binary");
    });

    it("reports legacy content formats as failures", async () => {
        const adapter = new BabylonGltfTileAdapter(createNullScene(), {
            fetch: respond(new TextEncoder().encode("b3dm\u0001\u0000\u0000\u0000")),
        });
        const { context, ready, failed } = createContext("https://example.test/tile.b3dm");

        await adapter.activate(context);

        expect(ready).not.toHaveBeenCalled();
        expect(String(failed.mock.calls[0]![1])).toContain('Unsupported tile content format "b3dm"');
    });

    it("builds request errors with the configured factory", async () => {
        const adapter = new BabylonGltfTileAdapter(createNullScene(), {
            fetch: respond(new Uint8Array(), { status: 403 }),
            createRequestError: (response) => new Error(`redacted ${response.status}`),
        });
        const { context, failed } = createContext("https://example.test/tile.glb?key=secret");

        await adapter.activate(context);

        expect(String(failed.mock.calls[0]![1])).toBe("Error: redacted 403");
    });

    it("cancels content once the activation is aborted", async () => {
        const adapter = new BabylonGltfTileAdapter(createNullScene(), { fetch: respond(encodeJson(EXTERNAL_TILESET)) });
        const { context, ready, cancelled, controller } = createContext("https://example.test/tileset.json");
        controller.abort();

        await adapter.activate(context);

        expect(ready).not.toHaveBeenCalled();
        expect(cancelled).toHaveBeenCalledWith("content-0");
    });
});
