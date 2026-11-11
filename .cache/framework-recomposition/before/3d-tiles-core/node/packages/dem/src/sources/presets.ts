import { WebMercatorTileMetrics, WebTileSource, type ITileHttpClientOptions, type TileHttpClient } from "@spacexr/tiles";

import type { DemEncoding } from "../codecs";

/** Web tile source of elevation tiles, with the encoding of its pixels. */
export interface IDemTileSource {
    source: WebTileSource;
    encoding: DemEncoding;
}

/** Options shared by the presets. */
export interface IPresetOptions {
    client?: TileHttpClient | ITileHttpClientOptions;
}

/**
 * Mapzen Terrain Tiles in Terrarium encoding, hosted by the AWS Open Data program.
 *
 * - 256 px PNG tiles in Web Mercator, XYZ rows.
 * - Levels 0 to 15. Deeper levels exist on the server but are resampled, so they are not exposed here.
 * - No API key. The data combines several public sources whose attribution is mandatory.
 */
export const MAPZEN_TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const MAPZEN_TERRARIUM_ATTRIBUTION = "Terrain Tiles by Mapzen, hosted by AWS Open Data. Data sources: https://github.com/tilezen/joerd/blob/master/docs/attribution.md";

/** Creates the Mapzen Terrarium elevation source. */
export function createMapzenTerrariumSource(options: IPresetOptions = {}): IDemTileSource {
    return {
        source: new WebTileSource({
            id: "mapzen-terrarium",
            urlTemplate: MAPZEN_TERRARIUM_URL,
            metrics: new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 15, tileSize: 256 }),
            // Its code sets the origin of each tile on its corner, and consecutive levels agree with centred pixels.
            registration: "area",
            attribution: MAPZEN_TERRARIUM_ATTRIBUTION,
            ...(options.client ? { client: options.client } : {}),
        }),
        encoding: "terrarium",
    };
}

/** Independent Mapzen provider normals. Alpha stores quantized elevation, not opacity. */
export const MAPZEN_NORMALS_URL = "https://s3.amazonaws.com/elevation-tiles-prod/normal/{z}/{x}/{y}.png";

/**
 * Creates the physical Mapzen normal source, independently of terrain geometry, heights and imagery.
 * Levels stop at 15; deeper geometry samples its ancestor UV area instead of generating normal tiles.
 */
export function createMapzenNormalsSource(options: IPresetOptions = {}): WebTileSource {
    return new WebTileSource({
        id: "mapzen-normals",
        urlTemplate: MAPZEN_NORMALS_URL,
        metrics: new WebMercatorTileMetrics({ minLOD: 0, maxLOD: 15, tileSize: 256 }),
        registration: "area",
        attribution: MAPZEN_TERRARIUM_ATTRIBUTION,
        ...(options.client ? { client: options.client } : {}),
    });
}
