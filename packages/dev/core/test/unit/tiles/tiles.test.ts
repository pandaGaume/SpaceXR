import { TileMetrics } from "../../../src/tiles/tiles.metrics";
import { EPSG3857 } from "../../../src/tiles/tiles.geography";
import { WebTileUrlBuilder } from "../../../src/tiles/tiles.urlBuilder";
import { ITileDatasource, ITileAddress } from "../../../src/tiles/tiles.interfaces";
import { TileAddress } from "../../../src/tiles/tiles.address";

class DummyDataSource<T> implements ITileDatasource<T, ITileAddress> {
    _data?: T;

    public constructor(data?: T) {
        this._data = data;
    }

    public fetchAsync(request: ITileAddress): Promise<T | undefined> {
        return Promise.resolve(this._data);
    }
}

describe("Tiles", () => {
    test("Web Mercator metrics", () => {
        const x = 875;
        const y = 589;
        const lod = 13;
        const metrics = new EPSG3857();
        const upperLeftLatLonA = metrics.getTileXYToLatLon(x, y, lod);
        const upperLeftPixelA = metrics.getTileXYToPixelXY(x, y, lod);
        const upperLeftLatLonB = metrics.getPixelXYToLatLon(upperLeftPixelA.x, upperLeftPixelA.y, lod);
        expect(upperLeftLatLonA).toEqual(upperLeftLatLonB);

        const upperLeftPixelC = metrics.getTileXYToPixelXY(x + 1, y + 1, lod);
        expect(upperLeftPixelC.x - upperLeftPixelA.x).toEqual(metrics.tileSize);
    });

    test("QuadKey", () => {
        const x = 875;
        const y = 589;
        const lod = 13;
        const k = TileMetrics.TileXYToQuadKey(new TileAddress(x, y, lod));
        const address = TileMetrics.QuadKeyToTileXY(k);
        expect(address).toEqual({ x: x, y: y, levelOfDetail: lod });
    });

    test("Web Url Factory", () => {
        const x = 875;
        const y = 589;
        const lod = 13;

        let url = new WebTileUrlBuilder()
            .withSecure(true)
            .withHost("s3.amazonaws.com")
            .withPath("elevation-tiles-prod/terrarium/{z}/{x}/{y}.{extension}")
            .withExtension("png")
            .buildUrl(x, y, lod);
        expect(url).toEqual(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${lod}/${x}/${y}.png`);
    });
});
