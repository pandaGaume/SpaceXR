import { Side } from "core/geometry";
import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { Float32TileCodec, Float32TileCodecOptionsBuilder, ImageTileCodec } from "../tiles.codecs.image";
import { EPSG3857 } from "../tiles.geography";
import { IPixelDecoder } from "../tiles.interfaces";
import { TileMetricsOptionsBuilder } from "../tiles.metrics";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
import { DemTileWebClient } from "core/dem";


export enum Openplanatary2DLayerCode {
    moon_basemap = "opm-moon-basemap-v0-1",
    mars_basemap = "opm-mars-basemap-v0-1",
    moon_hillshaded = "hillshaded-albedo",
    mars_viking = "viking_mdim21_global",
    mars_shaded_surface = "celestia_mars-shaded-16k_global",
    mars_shaded_grayscale = "mola-gray",
    mars_shaded_color = "mola-color",
    mars_hillshade = "mola_color-noshade_global",
    mars_elevation = "hillshade-tiles",
}

export class Openplanatary2DUrlBuilder extends WebTileUrlBuilder {
    public static MoonBasemap = new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.moon_basemap);

    public constructor(extension = "png", type: Openplanatary2DLayerCode | string) {
        super();

        // define the host in function of the type
        switch (type) {
            case Openplanatary2DLayerCode.moon_basemap:
            case Openplanatary2DLayerCode.mars_basemap:
                this.withHost("cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named");
                this.withPath(`${type}/all/{z}/{x}/{y}.{extension}`);
                break;
            case Openplanatary2DLayerCode.moon_hillshaded:
                //let ancien = "s3.amazonaws.com/opmbuilder/301_moon/tiles/w";
                let nouveau = "cors-anywhere.herokuapp.com/https://s3.amazonaws.com/opmbuilder/301_moon/tiles/w/";
                this.withHost(nouveau);
                this.withPath(`${type}/{z}/{x}/{y}.{extension}`);
                break;
            case Openplanatary2DLayerCode.mars_viking:
            case Openplanatary2DLayerCode.mars_shaded_surface:
            case Openplanatary2DLayerCode.mars_shaded_grayscale:
            case Openplanatary2DLayerCode.mars_shaded_color:
            case Openplanatary2DLayerCode.mars_hillshade:
                this.withHost(`s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/${type}`);
                this.withPath(`{z}/{x}/{y}.{extension}`);
                break;
            case Openplanatary2DLayerCode.mars_elevation:
                this.withHost("s3.us-east-2.amazonaws.com/opmmarstiles/hillshade-tiles");
                this.withPath(`{z}/{x}/{y}.{extension}`);
                break;
            default:
                throw new Error(`Unsupported type: ${type}`);
        }

        this.withSecure(true)
        .withExtension(extension);
    }
}

export class Openplanatary2DAltitudeDecoder implements IPixelDecoder {
    public static Shared = new Openplanatary2DAltitudeDecoder();

    public decode (pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number {
        const b = pixels[offset++];
        const w = pixels[offset++];

        target[targetOffset++] = (w + b);
        
        return targetOffset;
    }
}

export class Openplanatary{
    private static readonly KEY = "openplanatary";

    public static MaxLevelOfDetail = 13;
    public static MinLevelOfDetail = 3;
    public static MetricsOptions = new TileMetricsOptionsBuilder().withMaxLOD(Openplanatary.MaxLevelOfDetail).withMinLOD(Openplanatary.MinLevelOfDetail).build();
    public static Metrics = new EPSG3857(Openplanatary.MetricsOptions);

    public static MoonBasemapClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_moon_basemap`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.moon_basemap),new ImageTileCodec(), Openplanatary.Metrics, options);
    }

    public static MoonHillshadedClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_moon_hillshaded`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.moon_hillshaded),new ImageTileCodec(), Openplanatary.Metrics, options);
    }

    public static MarsBasemapClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_mars_basemap`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.mars_basemap),new ImageTileCodec(), Openplanatary.Metrics, options);
    }

    public static MarsVikingClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_mars_viking`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.mars_viking),new ImageTileCodec(), Openplanatary.Metrics, options);
    }

    public static MarsShadedSurfaceClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_mars_shaded_surface`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.mars_shaded_surface),new ImageTileCodec(), Openplanatary.Metrics, options);
    }

    public static MarsShadedGrayscaleClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_mars_shaded_grayscale`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.mars_shaded_grayscale),new ImageTileCodec(), Openplanatary.Metrics, options);
    }

    public static MarsShadedColorClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_mars_shaded_color`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.mars_shaded_color),new ImageTileCodec(), Openplanatary.Metrics, options);
    }

    public static MarsHillshadeClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_mars_hillshade`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.mars_hillshade),new ImageTileCodec(), Openplanatary.Metrics, options);
    }

    public static MarsElevationClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_mars_elevation`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.mars_elevation),new ImageTileCodec(), Openplanatary.Metrics, options);
    }

    public static MoonDemClient(options?: TileWebClientOptions) {
        const codecOptions = new Float32TileCodecOptionsBuilder().withInsets(1, Side.top).withInsets(1, Side.left).withInsets(1, Side.bottom).withInsets(1, Side.right).build();
        const elevationClient = new TileWebClient(
            `${Openplanatary.KEY}_moon_dem`,
            new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.moon_hillshaded),
            new Float32TileCodec(Openplanatary2DAltitudeDecoder.Shared, codecOptions),
            Openplanatary.Metrics,
            options
        );
        return new DemTileWebClient(`${Openplanatary.KEY}_dem`, elevationClient);
    }

    public static MarsDemClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${Openplanatary.KEY}_mars_dem`, new Openplanatary2DUrlBuilder("png", Openplanatary2DLayerCode.mars_shaded_grayscale),new Float32TileCodec(Openplanatary2DAltitudeDecoder.Shared), Openplanatary.Metrics, options);
    }
}