import { ITileAddress, ITileMetrics } from "./tiles.interfaces";
import { IGeo2 } from "../geography/geography.interfaces";
import { Geo2 } from "../geography/geography.position";
import { Size2 } from "../geometry/geometry.size";
import { Scalar } from "../math/math";
import { EPSG3857 } from "./tiles.geography";
import { IRectangle, ISize2, ICartesian2 } from "../geometry/geometry.interfaces";
import { Rectangle } from "../geometry/geometry.rectangle";
import { Observable } from "../events";
import { TileAddress } from "./tiles.address";
import { Cartesian2 } from "..";

export class UpdateEvents {
    public constructor(
        public bounds: IRectangle,
        public scale: ICartesian2,
        public added?: Array<ITileAddress>,
        public removed?: Array<ITileAddress>,
        public remain?: Array<ITileAddress>
    ) {}
}

export class View2<T> {
    public static ZOOM_ACC = 10000;

    // main map metrics
    _metrics: ITileMetrics;
    _center: IGeo2 = Geo2.Default;
    _size: ISize2 = Size2.Zero();
    _levelOfDetail: number = 0;

    // internal properties
    _valid: boolean;
    _innerbounds: IRectangle; // the bounds of the map in pixel coordinates, related to zoom level
    _outerbounds: IRectangle; // the bounds of the cache map in pixel coordinates, related to zoom level
    _outerboundsTileXY: IRectangle; // the bounds of the cache map in tile coordinates, related to zoom level
    _tiles: Array<ITileAddress>;
    _scale: ICartesian2;

    // events
    _updateObservable?: Observable<UpdateEvents>;

    public constructor(width: number, height: number, lat?: number, lon?: number, levelOfDetail?: number, metrics?: ITileMetrics) {
        this._metrics = metrics || EPSG3857.Shared;
        this.setLevelOfDetail(levelOfDetail || 0)
            .resize(width, height)
            .center(lat, lon);
        this._valid = false;
        this._innerbounds = Rectangle.Zero();
        this._outerbounds = Rectangle.Zero();
        this._outerboundsTileXY = Rectangle.Zero();
        this._scale = Cartesian2.One();
        this._tiles = [];
    }

    public get updateObservable(): Observable<UpdateEvents> {
        this._updateObservable = this._updateObservable || new Observable<UpdateEvents>();
        return this._updateObservable;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get tiles(): Array<ITileAddress> {
        this.validate();
        return this._tiles || [];
    }

    public get bounds(): IRectangle {
        this.validate();
        return this._innerbounds;
    }

    public get levelOfDetail(): number {
        return this._levelOfDetail;
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

    public get isValid(): boolean {
        return this._valid;
    }

    public setLevelOfDetail(v: number): View2<T> {
        const lod = Scalar.Clamp(v || 0, this._metrics.minLOD, this._metrics.maxLOD);
        if (lod != this._levelOfDetail) {
            this._levelOfDetail = lod;
            this.invalidate();
        }
        return this;
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

    public translate(x: number, y: number): View2<T> {
        const lod = Math.round(this._levelOfDetail);
        const pixelCenterXY = this._metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);

        pixelCenterXY.x += x;
        pixelCenterXY.y += y;
        const center = this._metrics.getPixelXYToLatLon(pixelCenterXY.x, pixelCenterXY.y, lod);
        return this.center(center.lat, center.lon);
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
        // for the purpose we need to know the scale factor which is depending of the transition state between zoom level
        const lod = Math.round(this._levelOfDetail);
        let lodOffset = this._levelOfDetail * View2.ZOOM_ACC - lod * View2.ZOOM_ACC; // Trick to avoid floating point error.
        let scale = lodOffset < 0 ? View2.ZOOM_ACC / (View2.ZOOM_ACC - lodOffset) : (View2.ZOOM_ACC + lodOffset) / View2.ZOOM_ACC;
        lodOffset /= View2.ZOOM_ACC;
        this._scale.x = scale;
        this._scale.y = scale;

        console.log("RAW LOD:", this._levelOfDetail, "LOD:", lod, ", OFFSET:", lodOffset, ", SX:", scale, ", SY:", scale);

        const w = this._size.width / scale;
        const h = this._size.height / scale;
        console.log("W:", w, "H:", h);

        const halfWitdh = w / 2;
        const halfHeight = h / 2;
        // given center, level of detail and size, compute the map bounds
        const pixelCenterXY = this._metrics.getLatLonToPixelXY(this._center.lat, this._center.lon, lod);
        const x0 = Math.round(pixelCenterXY.x - halfWitdh);
        const y0 = Math.round(pixelCenterXY.y - halfHeight);
        this._innerbounds = new Rectangle(x0, y0, w, h);
        const tileSize = this._metrics.tileSize;
        const tileSize2 = tileSize * 2;
        this._outerbounds = new Rectangle(x0 - tileSize, y0 - tileSize, w + tileSize2, h + tileSize2);
        console.log("Center", pixelCenterXY.toString());
        console.log("InnerBound", this._innerbounds.toString());
        console.log("OuterBound", this._outerbounds.toString());

        // given the pixel bounds we can easily validate or invalidate tile list
        const nwTileXY = this._metrics.getPixelXYToTileXY(this._outerbounds.left, this._outerbounds.top, lod);
        console.log("TileX:", nwTileXY.x, "TileY:", nwTileXY.y, " LevelOfDetail:", lod);
        const seTileXY = this._metrics.getPixelXYToTileXY(this._outerbounds.right, this._outerbounds.bottom, lod);
        const rect = Rectangle.FromPoints(nwTileXY, seTileXY);
        const remainBounds = rect.intersection(this._outerboundsTileXY);
        this._outerboundsTileXY = rect;

        const components = [];
        const hasObservers = this._updateObservable && this._updateObservable.hasObservers();
        let added = undefined;
        let remains = undefined;
        let removed = undefined;

        for (let ty = nwTileXY.y; ty <= seTileXY.y; ty++) {
            for (let tx = nwTileXY.x; tx <= seTileXY.x; tx++) {
                const c = new TileAddress(tx, ty, lod);
                components.push(c);
                if (hasObservers && !remainBounds?.contains(tx, ty)) {
                    added = added || new Array<ITileAddress>();
                    added.push(c);
                }
            }
        }

        if (hasObservers) {
            const old = this._tiles;
            this._tiles = components;

            for (const c of old) {
                if (remainBounds?.contains(c.x, c.y)) {
                    remains = remains || new Array<ITileAddress>();
                    remains.push(c);
                    continue;
                }
                removed = removed || new Array<ITileAddress>();
                removed.push(c);
            }

            const e = new UpdateEvents(this._innerbounds, this._scale, added, removed, remains);
            this._updateObservable?.notifyObservers(e);
        }
    }
}
