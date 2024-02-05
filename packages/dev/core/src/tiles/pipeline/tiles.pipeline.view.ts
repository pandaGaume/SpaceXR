import { Observable } from "../../events";
import { ITileAddress, ITileMetrics } from "../tiles.interfaces";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipelineLink, ITileView } from "./tiles.pipeline.interfaces";
import { TileAddress } from "../address";
import { Nullable } from "../../types";
import { ICartesian2, IRectangle, Rectangle, Cartesian2 } from "../../geometry";
import { ITileNavigationState } from "../navigation";
import { TilePipelineLink } from "./tiles.pipeline.link";
import { Bearing, Geo2 } from "../../geography";
import { DisplayUnit, ITileDisplay } from "../map";

export class TileView implements ITileView {
    _addedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _removedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _updatedObservable?: Observable<IPipelineMessageType<ITileAddress>>;

    _activ: Map<string, ITileAddress> = new Map<string, ITileAddress>();

    // internal pipeline links
    _links: Array<ITilePipelineLink<ITileAddress>> = [];

    // cached values
    _id: string;
    _geoTmp = Geo2.Zero();
    _pixelTmp = Cartesian2.Zero();

    public constructor(id: string) {
        this._id = id;
    }

    public get name(): string {
        return this._id;
    }

    public dispose(): void {
        // dispose the links
        for (const l of this._links) {
            l.dispose();
        }
        this._links = [];
    }

    public get addedObservable(): Observable<IPipelineMessageType<ITileAddress>> {
        this._addedObservable = this._addedObservable || new Observable<IPipelineMessageType<ITileAddress>>();
        return this._addedObservable!;
    }

    public get removedObservable(): Observable<IPipelineMessageType<ITileAddress>> {
        this._removedObservable = this._removedObservable || new Observable<IPipelineMessageType<ITileAddress>>();
        return this._removedObservable!;
    }

    public get updatedObservable(): Observable<IPipelineMessageType<ITileAddress>> {
        this._updatedObservable = this._updatedObservable || new Observable<IPipelineMessageType<ITileAddress>>();
        return this._updatedObservable!;
    }

    public linkTo(target: ITargetBlock<ITileAddress>, options?: ILinkOptions): void {
        // a view may be linked to several targets, so we need to keep track of them.
        if (this._links.findIndex((l) => l.target === target) === -1) {
            const link = new TilePipelineLink(this, target, options);
            this._links.push(link);
        }
    }

    public unlinkFrom(target: ITargetBlock<ITileAddress>): ITilePipelineLink<ITileAddress> | undefined {
        const i = this._links.findIndex((l) => l.target === target);
        if (i !== -1) {
            const l = this._links.splice(i)[0];
            l.dispose();
            return l;
        }
        return undefined;
    }

    public setContext(state: Nullable<ITileNavigationState>, display: Nullable<ITileDisplay>, metrics: ITileMetrics, dispatchEvent: boolean = true): void {
        if (!state || !display) {
            this._doClearContext(state, dispatchEvent);
            return;
        }
        this._doValidateContext(state, display, metrics, dispatchEvent);
    }

    private _doValidateContext(state: Nullable<ITileNavigationState>, display: Nullable<ITileDisplay>, metrics: ITileMetrics, dispatchEvent: boolean = true) {
        if (state && display) {
            const lod = TileAddress.ClampLod(state.lod, metrics);
            const scale = state.scale;

            const nwTileXY = Cartesian2.Zero();
            const seTileXY = Cartesian2.Zero();

            const pixelCenterXY = metrics.getLatLonToPointXY(state.center.lat, state.center.lon, lod);
            let w = display?.displayWidth ?? 0;
            let h = display?.displayHeight ?? 0;

            // enforce default unit.
            const unit = display.displayUnit ?? DisplayUnit.Pixels;

            switch (unit) {
                case DisplayUnit.Meters: {
                    // the we compute the width and heigt in pixel.
                    // remember that the width will change with the latitude.
                    // TODO : Check behaviors at the poles and the date line.
                    const calculator = display.geodesicCalculator;
                    calculator?.getLocationAtDistanceAzimuthToRef(state.center, display.displayHeight / 2, 0, this._geoTmp, true);
                    metrics.getLatLonToPointXYToRef(this._geoTmp.lat, this._geoTmp.lon, lod, this._pixelTmp);
                    h = Math.abs(this._pixelTmp.y - pixelCenterXY.y) * 2;
                    calculator?.getLocationAtDistanceAzimuthToRef(state.center, display.displayWidth / 2, 90, this._geoTmp, true);
                    metrics.getLatLonToPointXYToRef(this._geoTmp.lat, this._geoTmp.lon, lod, this._pixelTmp);
                    w = Math.abs(this._pixelTmp.x - pixelCenterXY.x) * 2;
                    // fall through pixels...
                }
                case DisplayUnit.Pixels: {
                    const rect = this.getRectangle(pixelCenterXY, w, h, scale, state.azimuth);
                    // compute the bounds of tile xy
                    metrics.getPointXYToTileXYToRef(rect.xmin, rect.ymin, nwTileXY);
                    metrics.getPointXYToTileXYToRef(rect.xmax, rect.ymax, seTileXY);
                    break;
                }

                default: {
                    throw new Error(`Units ${display.displayUnit} not supported.`);
                }
            }

            const maxIndex = metrics.mapSize(lod) / metrics.tileSize - 1;
            const x0 = Math.max(0, nwTileXY.x);
            const y0 = Math.max(0, nwTileXY.y);
            const x1 = Math.min(maxIndex, seTileXY.x);
            const y1 = Math.min(maxIndex, seTileXY.y);

            const remains = new Array<ITileAddress>();
            const added = new Array<ITileAddress>();

            const tmp = new TileAddress(0, 0, lod);
            for (tmp.y = y0; tmp.y <= y1; tmp.y++) {
                for (tmp.x = x0; tmp.x <= x1; tmp.x++) {
                    const key = tmp.quadkey;
                    const activ = this._activ.get(key);
                    if (activ) {
                        remains.push(activ);
                        this._activ.delete(key);
                        continue;
                    }
                    added.push(tmp.clone());
                }
            }

            let deleted = Array.from(this._activ.values());
            this._activ.clear();

            for (const a of remains) {
                this._activ.set(a.quadkey, a);
            }

            for (const a of added) {
                this._activ.set(a.quadkey, a);
            }

            if (dispatchEvent) {
                if (added.length && this._addedObservable?.hasObservers()) {
                    this._addedObservable.notifyObservers(added, -1, this, this);
                }
                if (deleted.length && this._removedObservable?.hasObservers()) {
                    this._removedObservable.notifyObservers(deleted, -1, this, this);
                }
            }
        }
    }

    private _doClearContext(state: Nullable<ITileNavigationState>, dispatchEvent: boolean = true) {
        if (state) {
            let deleted = Array.from(this._activ.values());
            this._activ.clear();

            if (dispatchEvent) {
                if (deleted.length && this._removedObservable?.hasObservers()) {
                    this._removedObservable.notifyObservers(deleted, -1, this, this);
                }
            }
        }
    }

    private getRectangle(center: ICartesian2, w: number, h: number, scale: number, azimuth: Bearing): IRectangle {
        w = w / scale;
        h = h / scale;
        const x0 = center.x - w / 2;
        const y0 = center.y - h / 2;
        let bounds = new Rectangle(x0, y0, w, h);
        // bounds.points is returning a new set of points, so we need to rotate them if azimuth is non zero.
        return azimuth ? Rectangle.FromPoints(...this.rotatePointsArround(center, azimuth, ...bounds.points())) : bounds;
    }

    private *rotatePointsArround(center: ICartesian2, azimuth: Bearing, ...points: ICartesian2[]): IterableIterator<ICartesian2> {
        for (const p of points) {
            yield this.rotatePointArround(p.x, p.y, center, azimuth, p);
        }
    }

    private rotatePointArround<R extends ICartesian2>(x: number, y: number, center: ICartesian2, azimuth: Bearing, target?: R): R {
        const r = target || Cartesian2.Zero();
        const translatedX = x - center.x;
        const translatedY = y - center.y;
        const cos = azimuth?.cos ?? 1;
        const sin = azimuth?.sin ?? 0;
        r.x = translatedX * cos - translatedY * sin + center.x;
        r.y = translatedX * sin + translatedY * cos + center.y;
        return <R>r;
    }
}
