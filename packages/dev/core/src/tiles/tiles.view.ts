import { ITileAddress, ITileMetrics, LookupData } from "./tiles.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { Geo2 } from "../geography/geography.position";
import { Size2 } from "../geometry/geometry.size";
import { Scalar } from "../math/math";
import { EPSG3857 } from "./tiles.geography";
import { IRectangle, ISize2 } from "../geometry/geometry.interfaces";
import { Rectangle } from "../geometry/geometry.rectangle";
import { Cartesian2 } from "../geometry/geometry.cartesian";

export class TileComponent<T> implements ITileAddress {
    _x: number;
    _y: number;
    _levelOfDetail: number;
    _px: number;
    _py: number;
    _value?: LookupData<T>;

    public constructor(x: number, y: number, levelOfDetail: number, px: number, py: number) {
        this._x = x;
        this._y = y;
        this._levelOfDetail = levelOfDetail;
        this._px = px;
        this._py = py;
    }

    public get address(): ITileAddress | undefined {
        return this;
    }
    public get x(): number {
        return this._x;
    }
    public get y(): number {
        return this._y;
    }
    public get levelOfDetail(): number {
        return this._levelOfDetail;
    }
    public get data(): LookupData<T> {
        return this._value;
    }
    public set data(v: LookupData<T>) {
        this._value = v;
    }
    public get px(): number {
        return this._px;
    }
    public get py(): number {
        return this._py;
    }
}

export class View2<T> {
    // main map metrics
    _metrics: ITileMetrics;
    _center: IGeo2 = Geo2.Default;
    _size: ISize2 = Size2.Zero();
    _levelOfDetail: number = 0;
    _levelOfDetailOffset: number = 0;

    // internal properties
    _valid: boolean;
    _innerbounds: IRectangle; // the bounds of the map in pixel coordinates, related to zoom level
    _outerbounds: IRectangle; // the bounds of the cache map in pixel coordinates, related to zoom level
    _tiles: Array<TileComponent<T>>;

    public constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?: ITileMetrics) {
        this._metrics = metrics || EPSG3857.Shared;
        this.levelOfDetail = levelOfDetail || 0;
        this.resize(width, height).center(lat, lon);
        this._valid = false;
        this._innerbounds = Rectangle.Zero();
        this._outerbounds = Rectangle.Zero();
        this._tiles = [];
    }

    public get tiles(): Array<TileComponent<T>> {
        this.validate();
        return this._tiles || [];
    }

    public get bounds(): IRectangle {
        this.validate();
        return this._innerbounds;
    }

    public get levelOfDetail(): number {
        return Math.floor(this._levelOfDetail);
    }

    public set levelOfDetail(v: number) {
        const tmp = Scalar.Clamp(v || 0, this._metrics.minLOD, this._metrics.maxLOD);
        const lod = Math.round(tmp);
        const offset = tmp - lod;
        if (lod != this._levelOfDetail || offset != this._levelOfDetailOffset) {
            this._levelOfDetail = lod;
            this._levelOfDetailOffset = offset;
            this.invalidate();
        }
    }

    public get width(): number {
        return this._size?.width || 0;
    }

    public get height(): number {
        return this._size?.height || 0;
    }

    public get lat(): number {
        return this._center?.lat || Geo2.Default.lat;
    }

    public get lon(): number {
        return this._center?.lon || Geo2.Default.lon;
    }

    public get scaling(): number {
        return this._levelOfDetailOffset < 0 ? 1 / (1 - this._levelOfDetailOffset) : 1 + this._levelOfDetailOffset;
    }

    public get levelOfDetailOffset(): number {
        return this._levelOfDetailOffset;
    }

    public get isValid(): boolean {
        return this._valid;
    }

    public resize(width: number, height: number): View2<T> {
        const w = Math.abs(width);
        const h = Math.abs(height);
        this._size = this._size || Size2.Zero();
        if (w != this._size.width || h != this._size.height) {
            this._size.width = w;
            this._size.height = h;
            return this.invalidate();
        }
        return this;
    }

    public center(lat?: number, lon?: number): View2<T> {
        const latitude = Scalar.Clamp(lat || Geo2.Default.lat, this._metrics.minLatitude, this._metrics.maxLatitude);
        const longitude = Scalar.Clamp(lon || Geo2.Default.lon, this._metrics.minLongitude, this._metrics.maxLongitude);
        this._center = this._center || Geo2.Zero();
        if (this._center.lat != latitude || this._center.lon != longitude) {
            this._center.lat = latitude;
            this._center.lon = longitude;
            return this.invalidate();
        }
        return this;
    }

    public invalidate(): View2<T> {
        this._valid = false;
        return this;
    }

    public validate(): View2<T> {
        if (!this._valid) {
            this.doValidate();
            this._valid = true;
        }
        return this;
    }

    protected doValidate() {
        // given center, level of detail and size, compute the map bounds
        const pixelCenterXY = this._metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, this._levelOfDetail);

        // for the purpose we need to know the scale factor which is depending of the transition state between zoom level
        const scale = this.scaling;
        const w = this._size.width * scale;
        const h = this._size.height * scale;
        const lod = Math.floor(this._levelOfDetail);

        const halfWitdh = w / 2;
        const halfHeight = h / 2;
        const x0 = Math.round(pixelCenterXY.x - halfWitdh);
        const y0 = Math.round(pixelCenterXY.y - halfHeight);
        this._innerbounds = new Rectangle(x0, y0, w, h);
        const tileSize = this._metrics.tileSize * scale;
        const tileSize2 = tileSize * 2;
        this._outerbounds = new Rectangle(x0 - tileSize, y0 - tileSize, w + tileSize2, h + tileSize2);

        // given the pixel bounds we can easily validate or invalidate tile list
        const nwTileXY = this._metrics.getPixelXYToTileXY(this._outerbounds.left, this._outerbounds.top, lod);
        const seTileXY = this._metrics.getPixelXYToTileXY(this._outerbounds.right, this._outerbounds.bottom, lod);

        const components = [];
        const tmp = Cartesian2.Zero();
        for (let ty = nwTileXY.y; ty <= seTileXY.y; ty++) {
            for (let tx = nwTileXY.x; tx <= seTileXY.x; tx++) {
                const pixelXY = this._metrics.getTileXYToPixelXY(tx, ty, lod, tmp);
                components.push(new TileComponent<T>(tx, ty, lod, pixelXY.x, pixelXY.y));
            }
        }
        this._tiles = components;
    }
}
