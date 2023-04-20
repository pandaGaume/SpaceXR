import { TileClientOptions } from "shelly/src/tiles/tiles.client";
import { IRgbValueDecoder, ITileUrlFactory } from "dev/shelly/src/tiles/tiles.interfaces";
import { WebTileUrlFactory, WebTileUrlFactoryOptions } from "shelly/src/tiles/tiles.urlFactories";
import { ImageDecoderTileCodec } from "shelly/src/tiles/tiles.codecs.image";

export class MapZenTerrainUrlFactoryOptions extends WebTileUrlFactoryOptions {
    _type: string;

    public constructor(type: string, extension = "png") {
        super();
        this._type = type;
        this.host = "s3.amazonaws.com";
        this.path = "elevation-tiles-prod/" + type + "/{3}/{1}/{2}.{4}";
        this.isSecure = true;
        this.extension = extension;
    }
}

export class MapzenRgbValueDecoder implements IRgbValueDecoder<number> {
    public static Shared = new MapzenRgbValueDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, size: number): number {
        if (size < 3) {
            return 0;
        }
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];

        const z = r * 256 + g + b / 256 - 32768;
        return z;
    }
}

export class MapzenNormalValueDecoder implements IRgbValueDecoder<Array<number>> {
    public static Shared = new MapzenRgbValueDecoder();

    public decode(pixels: Uint8ClampedArray, offset: number, size: number): Array<number> {
        if (size < 3) {
            return [];
        }
        const r = pixels[offset++];
        const g = pixels[offset++];
        const b = pixels[offset];
        const x = (2 * r) / 255 - 1;
        const y = (2 * g) / 255 - 1;
        const z = (b - 128) / 127;
        return [x, z, y];
    }
}

export class MapZenTileClientOptions extends TileClientOptions<Float32Array> {
    public static Terrarium = new MapZenTileClientOptions(
        new WebTileUrlFactory(new MapZenTerrainUrlFactoryOptions("terrarium")),
        new ImageDecoderTileCodec(MapzenRgbValueDecoder.Shared)
    );

    public static Normal = new MapZenTileClientOptions(
        new WebTileUrlFactory(new MapZenTerrainUrlFactoryOptions("normal")),
        new ImageDecoderTileCodec(MapzenRgbValueDecoder.Shared)
    );

    public constructor(urlFactory: ITileUrlFactory, codec: ImageDecoderTileCodec) {
        super(urlFactory, codec);
    }
}
