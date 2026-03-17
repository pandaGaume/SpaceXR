import { TileWebClient } from "../tiles.client";
import { ImageTileClient } from "../tiles.client.image";
import { ImageTileCodec } from "../codecs/tiles.codecs.image";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { WebTileUrlBuilder } from "../tiles.url.web";
import { WebClientOptions } from "../../io";
import { SolarSystemBodies } from "../../space";

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
}
