import { TileWebClient, TileWebClientOptions } from "./tiles.client";
import { IPixelDecoder } from "./tiles.interfaces";
import { WebTileUrlBuilder } from "./tiles.urlBuilder";
import { Float32TileCodec, ImageTileCodec } from "./tiles.codecs.image";
import { TileMetricsOptionsBuilder } from "./tiles.metrics";

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

export class MapzenNormalValueDecoder implements IPixelDecoder {
    public static Shared = new MapzenNormalValueDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number {
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];
        target[targetOffset++] = (2 * r) / 255 - 1;
        target[targetOffset++] = (2 * g) / 255 - 1;
        target[targetOffset++] = (b - 128) / 127;
        return targetOffset;
    }
}

export class MapZen {
    public static MaxLevelOfDetail = 15;
    public static MetricsOptions = new TileMetricsOptionsBuilder().withMaxLOD(MapZen.MaxLevelOfDetail).build();

    public static DemImagesClient(options?: TileWebClientOptions) {
        return new TileWebClient(MapZenDemUrlBuilder.Terrarium, new ImageTileCodec(), options);
    }
    public static DemClient(options?: TileWebClientOptions) {
        return new TileWebClient(MapZenDemUrlBuilder.Terrarium, new Float32TileCodec(MapzenAltitudeDecoder.Shared), options);
    }
    public static NormalImagesClient(options?: TileWebClientOptions) {
        return new TileWebClient(MapZenDemUrlBuilder.Normal, new ImageTileCodec());
    }
    public static NormalClient(options?: TileWebClientOptions) {
        return new TileWebClient(MapZenDemUrlBuilder.Normal, new Float32TileCodec(MapzenNormalValueDecoder.Shared), options);
    }
}
