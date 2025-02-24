import { TileWebClient, TileWebClientOptions } from "../tiles.client";
import { WebTileUrlBuilder } from "../tiles.url.web";
import { Float32TileCodec, Float32TileCodecOptions, ImageTileCodec, RGBTileCodec } from "../codecs/tiles.codecs.image";
import { EPSG3857 } from "../geography/tiles.geography.EPSG3857";
import { DemTileWebClient } from "../../dem/dem.tileclient";
import { IPixelDecoder, isFilter } from "../codecs/tiles.codecs.interfaces";
import { Cartesian4, ICartesian4 } from "../../geometry";
import { Cartesian4TileCodec } from "../codecs/tiles.codecs.cartesian";

export class MapZenDemUrlBuilder extends WebTileUrlBuilder {
    public static Terrarium = new MapZenDemUrlBuilder("terrarium");
    public static Normal = new MapZenDemUrlBuilder("normal");

    public constructor(format: string, extension = "png") {
        super();
        this.withHost("s3.amazonaws.com").withPath(`elevation-tiles-prod/${format}/{z}/{x}/{y}.{extension}`).withSecure(true).withExtension(extension);
    }
}

export class MapzenAltitudeDecoder implements IPixelDecoder<Float32Array> {
    public static Shared = new MapzenAltitudeDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number {
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];

        target[targetOffset++] = r * 256 + g + b / 256 - 32768;
        return targetOffset;
    }
}

export class MapZenNormalsDecoder implements IPixelDecoder<Array<ICartesian4>> {
    public static Shared = new MapZenNormalsDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, target: Array<ICartesian4>, targetOffset: number): number {
        let v = target[targetOffset];
        if (!v) {
            v = target[targetOffset] = Cartesian4.Zero();
        }
        v.x = pixels[offset++];
        v.y = pixels[offset++];
        v.z = pixels[offset++];
        v.w = pixels[offset];
        return targetOffset + 1;
    }
}

export class MapZen {
    private static readonly KEY = "mapzen";

    // in theory, mapzen is going to zoom 15, but we experiencing too many elevation error.
    public static MaxLevelOfDetail = 15;
    public static Metrics = new EPSG3857({ maxLOD: MapZen.MaxLevelOfDetail });
    public static Attribution = "Freely provided by MapZen - with thanks.";

    public static ElevationsImagesClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${MapZen.KEY}_terrarium`, MapZenDemUrlBuilder.Terrarium, new ImageTileCodec(), MapZen.Metrics, options);
    }
    public static ElevationsClient(options?: TileWebClientOptions) {
        const o = isFilter<Float32Array>(options?.filter) ? new Float32TileCodecOptions({ filter: options?.filter }) : undefined;
        return new TileWebClient(`${MapZen.KEY}_terrarium_float`, MapZenDemUrlBuilder.Terrarium, new Float32TileCodec(MapzenAltitudeDecoder.Shared, o), MapZen.Metrics, options);
    }
    public static NormalsImagesClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${MapZen.KEY}_normal`, MapZenDemUrlBuilder.Normal, new ImageTileCodec(), MapZen.Metrics, options);
    }
    public static NormalsUint8ArrayClient(options?: TileWebClientOptions) {
        return new TileWebClient(`${MapZen.KEY}_normal`, MapZenDemUrlBuilder.Normal, new RGBTileCodec(), MapZen.Metrics, options);
    }
    public static NormalsCartesian4Client(options?: TileWebClientOptions) {
        return new TileWebClient(`${MapZen.KEY}_normal_Cartesian4`, MapZenDemUrlBuilder.Normal, new Cartesian4TileCodec(MapZenNormalsDecoder.Shared), MapZen.Metrics, options);
    }
    public static DemClient(optionsElevations?: TileWebClientOptions, optionsNormals?: TileWebClientOptions) {
        return new DemTileWebClient(`${MapZen.KEY}_dem`, MapZen.ElevationsClient(optionsElevations), MapZen.NormalsUint8ArrayClient(optionsNormals));
    }
}
