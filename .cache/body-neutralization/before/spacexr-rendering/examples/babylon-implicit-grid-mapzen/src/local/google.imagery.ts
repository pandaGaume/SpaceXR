// Local only: this file is ignored by git and must not be published.
import { BrowserImageDecoder } from "@spacexr/raster";
import { WebMercatorTileMetrics, WebTileSource } from "@spacexr/tiles";

import type { ILocalImagery } from "../local-imagery";

const MAX_LOD = 20;

/** Google satellite tiles, from the SpaceXR `GoogleMap2DUrlBuilder.Satellite` endpoint. */
export function createImagery(): ILocalImagery {
    const source = new WebTileSource({
        id: "google-satellite",
        urlTemplate: "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        metrics: new WebMercatorTileMetrics({ minLOD: 0, maxLOD: MAX_LOD }),
        registration: "area",
        attribution: "Imagery © Google",
    });
    const images = new BrowserImageDecoder();
    return {
        maxLOD: MAX_LOD,
        registration: source.registration,
        attribution: source.attribution ?? "",
        load: async (address) => {
            const result = await source.fetchTile(address);
            return result.status === "absent"
                ? undefined
                : images.decode(result.bytes);
        },
    };
}
