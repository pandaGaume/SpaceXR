import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { EPSG3857 } from "../tiles.geography";
import { IPixelDecoder } from "../tiles.interfaces";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
import { DemTileWebClient } from "core/dem";
export declare enum Openplanatary2DLayerCode {
    moon_basemap = "opm-moon-basemap-v0-1",
    mars_basemap = "opm-mars-basemap-v0-1",
    moon_hillshaded = "hillshaded-albedo",
    mars_viking = "viking_mdim21_global",
    mars_shaded_surface = "celestia_mars-shaded-16k_global",
    mars_shaded_grayscale = "mola-gray",
    mars_shaded_color = "mola-color",
    mars_hillshade = "mola_color-noshade_global",
    mars_elevation = "hillshade-tiles"
}
export declare class Openplanatary2DUrlBuilder extends WebTileUrlBuilder {
    static MoonBasemap: Openplanatary2DUrlBuilder;
    constructor(extension: string | undefined, type: Openplanatary2DLayerCode | string);
}
export declare class Openplanatary2DAltitudeDecoder implements IPixelDecoder {
    static Shared: Openplanatary2DAltitudeDecoder;
    decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number;
}
export declare class Openplanatary {
    private static readonly KEY;
    static MaxLevelOfDetail: number;
    static MinLevelOfDetail: number;
    static MetricsOptions: import("../tiles.interfaces").ITileMetricsOptions;
    static Metrics: EPSG3857;
    static MoonBasemapClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static MoonHillshadedClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static MarsBasemapClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static MarsVikingClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static MarsShadedSurfaceClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static MarsShadedGrayscaleClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static MarsShadedColorClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static MarsHillshadeClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static MarsElevationClient(options?: TileWebClientOptions): TileWebClient<HTMLImageElement>;
    static MoonDemClient(options?: TileWebClientOptions): DemTileWebClient;
    static MarsDemClient(options?: TileWebClientOptions): TileWebClient<Float32Array>;
}
