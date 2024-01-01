import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { WebTileUrlBuilder } from "../tiles.urlBuilder";
import { Float32TileCodec, ImageTileCodec, RGBATileCodec } from "../codecs/tiles.codecs.image";
import { TileMetricsOptionsBuilder } from "../tiles.metrics";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { DemTileWebClient } from "../../dem/dem.tileclient";
import { IPixelDecoder } from "../codecs/tiles.codecs.interfaces";

export class MapZenDemUrlBuilder extends WebTileUrlBuilder {
    public static Terrarium = new MapZenDemUrlBuilder("terrarium");
    public static Normal = new MapZenDemUrlBuilder("normal");

    public constructor(format: string, extension = "png") {
        super();
        this.withHost("s3.amazonaws.com").withPath(`elevation-tiles-prod/${format}/{z}/{x}/{y}.{extension}`).withSecure(true).withExtension(extension);
    }
}

export class MapzenAltitudeDecoder implements IPixelDecoder {
    public static Shared = new MapzenAltitudeDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number {
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];

        target[targetOffset++] = r * 256 + g + b / 256 - 32768;
        return targetOffset;
    }
}

export class MapZen {
    private static readonly KEY = "mapzen";

    public static MaxLevelOfDetail = 15;
    public static MetricsOptions = new TileMetricsOptionsBuilder().withMaxLOD(MapZen.MaxLevelOfDetail).build();
    public static Metrics = new EPSG3857(MapZen.MetricsOptions);

    public static ElevationsImagesClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${MapZen.KEY}_terrarium`, MapZenDemUrlBuilder.Terrarium, new ImageTileCodec(), MapZen.Metrics, options);
    }
    public static ElevationsClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${MapZen.KEY}_terrarium_float`, MapZenDemUrlBuilder.Terrarium, new Float32TileCodec(MapzenAltitudeDecoder.Shared), MapZen.Metrics, options);
    }
    public static NormalsImagesClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${MapZen.KEY}_normal`, MapZenDemUrlBuilder.Normal, new ImageTileCodec(), MapZen.Metrics, options);
    }
    public static NormalsClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${MapZen.KEY}_normal_float`, MapZenDemUrlBuilder.Normal, new RGBATileCodec(), MapZen.Metrics, options);
    }
    public static DemClient(optionsElevations?: TileWebClientOptions, optionsNormals?: TileWebClientOptions) {
        return new DemTileWebClient(`${MapZen.KEY}_dem`, MapZen.ElevationsClient(optionsElevations), MapZen.NormalsImagesClient(optionsNormals));
    }
}
