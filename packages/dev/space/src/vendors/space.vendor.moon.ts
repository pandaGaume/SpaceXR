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

export class MoonUrlBuilder extends WebTileUrlBuilder {
    /** Carto CDN — supports CORS */
    public static Basemap = new MoonUrlBuilder("cartocdn-gusc.global.ssl.fastly.net", "opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.{extension}");
    /** Raw S3 — no CORS headers, TMS Y convention, must be loaded via <img> */
    public static HillshadeAlbedo = new MoonUrlBuilder("s3.amazonaws.com", "opmbuilder/301_moon/tiles/w/hillshaded-albedo/{z}/{x}/{y}.{extension}", true);

    public constructor(host: string, path: string, tms: boolean = false) {
        super();
        this.withSecure(true).withHost(host).withPath(path).withExtension("png");
        if (tms) {
            this.withTMSY(true);
        }
    }
}

export class Moon {
    private static readonly KEY = "moon";

    public static MaxLevelOfDetail = 7;
    public static Metrics = new EPSG3857({ maxLOD: Moon.MaxLevelOfDetail }, SolarSystemBodies.Moon.ellipsoid);
    public static Attribution = "OpenPlanetary / USGS / NASA";

    // LOLA DEM elevation range (meters)
    private static readonly LOLA_MIN = -9128;
    private static readonly LOLA_MAX = 10786;

    /** NASA Trek ArcGIS ImageServer — LRO LOLA DEM (256 ppd) */
    private static readonly LOLA_DEM_URL = "https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer/exportImage";

    public static BasemapClient(options?: WebClientOptions) {
        return new TileWebClient(`${Moon.KEY}_basemap`, MoonUrlBuilder.Basemap, new ImageTileCodec(), Moon.Metrics, options);
    }

    public static HillshadeClient(options?: WebClientOptions) {
        // Uses ImageTileClient (loads via <img>) because S3 does not serve CORS headers
        return new ImageTileClient(`${Moon.KEY}_hillshade`, MoonUrlBuilder.HillshadeAlbedo, Moon.Metrics, options);
    }

    /**
     * Returns a tile client that fetches LOLA DEM elevations as Float32Array.
     * Each pixel is decoded from ArcGIS grayscale (0–255) to meters using the LOLA elevation range.
     */
    public static ElevationsClient(options?: WebClientOptions) {
        const urlBuilder = new ArcGISImageServerUrlBuilder(Moon.LOLA_DEM_URL, SolarSystemBodies.Moon.ellipsoid.semiMajorAxis);
        const decoder = new ArcGISGrayscaleElevationDecoder(Moon.LOLA_MIN, Moon.LOLA_MAX);
        const o = isFilter<Float32Array>(options?.filter) ? new Float32TileCodecOptions({ filter: options?.filter }) : undefined;
        return new TileWebClient(`${Moon.KEY}_lola_dem`, urlBuilder, new Float32TileCodec(decoder, o), Moon.Metrics, options);
    }

    /**
     * Returns a DEM tile client combining LOLA elevations with computed normals.
     * Compatible with the existing DemTileWebClient pipeline.
     */
    public static DemClient(options?: WebClientOptions) {
        return new DemTileWebClient(`${Moon.KEY}_dem`, Moon.ElevationsClient(options));
    }
}
