import { TileWebClient } from "core/tiles/tiles.client";
import { ImageTileClient } from "core/tiles/tiles.client.image";
import { ImageTileCodec, Float32TileCodec, Float32TileCodecOptions } from "core/tiles/codecs/tiles.codecs.image";
import { isFilter } from "core/tiles/codecs/tiles.codecs.interfaces";
import { EPSG3857 } from "core/tiles/geography/tiles.geography.EPSG3857";
import { WebTileUrlBuilder } from "core/tiles/tiles.url.web";
import { WebClientOptions } from "core/io";
import { SolarSystemBodies } from "..";
import { ArcGISImageServerUrlBuilder, ArcGISGrayscaleElevationDecoder } from "core/tiles/vendors/tiles.vendors.arcgis";
import { DemTileWebClient } from "core/dem/dem.tileclient";

export class MarsUrlBuilder extends WebTileUrlBuilder {
    /** Carto CDN — supports CORS */
    public static Basemap = new MarsUrlBuilder("cartocdn-gusc.global.ssl.fastly.net", "opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.{extension}");
    /** Raw S3 — no CORS headers, TMS Y convention */
    public static MOLAColor = new MarsUrlBuilder("s3-eu-west-1.amazonaws.com", "whereonmars.cartodb.net/mola-color/{z}/{x}/{y}.{extension}", true);
    /** Raw S3 — no CORS headers, TMS Y convention */
    public static MOLAGray = new MarsUrlBuilder("s3-eu-west-1.amazonaws.com", "whereonmars.cartodb.net/mola-gray/{z}/{x}/{y}.{extension}", true);
    /** Raw S3 — no CORS headers, TMS Y convention */
    public static Surface = new MarsUrlBuilder("s3-eu-west-1.amazonaws.com", "whereonmars.cartodb.net/celestia_mars-shaded-16k_global/{z}/{x}/{y}.{extension}", true);

    public constructor(host: string, path: string, tms: boolean = false) {
        super();
        this.withSecure(true).withHost(host).withPath(path).withExtension("png");
        if (tms) {
            this.withTMSY(true);
        }
    }
}

export class Mars {
    private static readonly KEY = "mars";

    public static MaxLevelOfDetail = 7;
    public static Metrics = new EPSG3857({ maxLOD: Mars.MaxLevelOfDetail }, SolarSystemBodies.Mars.ellipsoid);
    public static Attribution = "OpenPlanetary / USGS / NASA";

    // MOLA DEM elevation range (meters)
    private static readonly MOLA_MIN = -8201;
    private static readonly MOLA_MAX = 21241;

    /** NASA Trek ArcGIS ImageServer — MOLA DEM (128/64 ppd merge) */
    private static readonly MOLA_DEM_URL = "https://trek.nasa.gov/mars/trekarcgis/rest/services/mola128_mola64_merge_90Nto90S_SimpleC_clon0/ImageServer/exportImage";

    public static BasemapClient(options?: WebClientOptions) {
        // Carto CDN serves CORS headers — use standard fetch-based client
        return new TileWebClient(`${Mars.KEY}_basemap`, MarsUrlBuilder.Basemap, new ImageTileCodec(), Mars.Metrics, options);
    }

    public static MOLAColorClient(options?: WebClientOptions) {
        // Raw S3, no CORS — use <img> loading
        return new ImageTileClient(`${Mars.KEY}_mola_color`, MarsUrlBuilder.MOLAColor, Mars.Metrics, options);
    }

    public static MOLAGrayClient(options?: WebClientOptions) {
        // Raw S3, no CORS — use <img> loading
        return new ImageTileClient(`${Mars.KEY}_mola_gray`, MarsUrlBuilder.MOLAGray, Mars.Metrics, options);
    }

    public static SurfaceClient(options?: WebClientOptions) {
        // Raw S3, no CORS — use <img> loading
        return new ImageTileClient(`${Mars.KEY}_surface`, MarsUrlBuilder.Surface, Mars.Metrics, options);
    }

    /**
     * Returns a tile client that fetches MOLA DEM elevations as Float32Array.
     * Each pixel is decoded from ArcGIS grayscale (0–255) to meters using the MOLA elevation range.
     */
    public static ElevationsClient(options?: WebClientOptions) {
        const urlBuilder = new ArcGISImageServerUrlBuilder(Mars.MOLA_DEM_URL, SolarSystemBodies.Mars.ellipsoid.semiMajorAxis);
        const decoder = new ArcGISGrayscaleElevationDecoder(Mars.MOLA_MIN, Mars.MOLA_MAX);
        const o = isFilter<Float32Array>(options?.filter) ? new Float32TileCodecOptions({ filter: options?.filter }) : undefined;
        return new TileWebClient(`${Mars.KEY}_mola_dem`, urlBuilder, new Float32TileCodec(decoder, o), Mars.Metrics, options);
    }

    /**
     * Returns a DEM tile client combining MOLA elevations with computed normals.
     * Compatible with the existing DemTileWebClient pipeline.
     */
    public static DemClient(options?: WebClientOptions) {
        return new DemTileWebClient(`${Mars.KEY}_dem`, Mars.ElevationsClient(options));
    }
}
