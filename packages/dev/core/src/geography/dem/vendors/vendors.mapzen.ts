import { TileClientOptions } from "shelly/src/tiles/tiles.client";
import { IPixelDecoder } from "shelly/src/tiles/tiles.interfaces";
import { WebTileUrlFactory, WebTileUrlFactoryOptions } from "shelly/src/tiles/tiles.urlFactories";
import { Float32TileCodec } from "shelly/src/tiles/tiles.codecs.image";

class MapZenTerrainUrlFactoryOptions extends WebTileUrlFactoryOptions {
    public constructor(format: string, extension = "png") {
        super();
        this.host = "s3.amazonaws.com";
        this.path = `elevation-tiles-prod/${format}/{z}/{x}/{y}.{extension}`;
        this.isSecure = true;
        this.extension = extension;
    }
}

class MapzenAltitudeDecoder implements IPixelDecoder {
    public static Shared = new MapzenAltitudeDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, target: Float32Array, targetOffset: number): number {
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];

        target[targetOffset++] = r * 256 + g + b / 256 - 32768;
        return targetOffset;
    }
}

class MapzenNormalValueDecoder implements IPixelDecoder {
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

export class MapZenTileClientOptions {
    public static Terrarium = new TileClientOptions(new WebTileUrlFactory(new MapZenTerrainUrlFactoryOptions("terrarium")), new Float32TileCodec(MapzenAltitudeDecoder.Shared));
    public static Normal = new TileClientOptions(new WebTileUrlFactory(new MapZenTerrainUrlFactoryOptions("normal")), new Float32TileCodec(MapzenNormalValueDecoder.Shared));
}
