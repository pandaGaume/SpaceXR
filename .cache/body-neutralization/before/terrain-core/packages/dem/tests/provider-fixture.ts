import { GeodeticSystem } from "@spacexr/geodesy";
import { WebMercatorTileMetrics, WebTileSource, type ITileHttpClientOptions, type TileHttpClient } from "@spacexr/tiles";
import type { IDemTileSource } from "../src";

/** Explicit test-only provider, with no network access unless supplied by a test. */
export function createMapzenTerrariumSource(options: { client?: TileHttpClient | ITileHttpClientOptions } = {}): IDemTileSource {
    return { source: createMapzenNormalsSource(options), encoding: "terrarium" };
}
export function createMapzenNormalsSource(options: { client?: TileHttpClient | ITileHttpClientOptions } = {}): WebTileSource {
    return new WebTileSource({ id: "test-provider", urlTemplate: "https://fixture.invalid/{z}/{x}/{y}.png", metrics: new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 15, tileSize: 256 }, GeodeticSystem.WGS84), registration: "area", ...(options.client ? { client: options.client } : {}) });
}
