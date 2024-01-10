import { Observable } from "../../events";
import { ITileAddress, ITileDisplay, ITileMetrics } from "../tiles.interfaces";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipelineLink, ITileView } from "./tiles.pipeline.interfaces";
import { TileAddress } from "../address";
import { Nullable } from "../../types";
import { ICartesian2, IRectangle, Rectangle, Cartesian2 } from "../../geometry";
import { ITileNavigationState } from "../navigation";
import { TilePipelineLink } from "./tiles.pipeline.link";
import { Bearing } from "core/geography";

export class TileView implements ITileView {
    _addedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _removedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _updatedObservable?: Observable<IPipelineMessageType<ITileAddress>>;

    _activ: Map<string, ITileAddress> = new Map<string, ITileAddress>();

    // internal pipeline links
    _links: Array<ITilePipelineLink<ITileAddress>> = [];

    // cached values
    _id: string;

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

    // TODO : Introduce lod context for each zoffset... the idea is to limit the zoom level for each zoffset at the metrics max & min lod.
    // ALSO : Find a way to limit the navigation state to a specific lod range, as a navigation state MAY be shared by several views or pipelines...
    private _doValidateContext(state: Nullable<ITileNavigationState>, display: Nullable<ITileDisplay>, metrics: ITileMetrics, dispatchEvent: boolean = true) {
        if (state && display) {
            console.log("TileView._doValidateContext", state.toString(), display, metrics);
            const lod = TileAddress.ClampLod(state.lod, metrics);
            const pixelCenterXY = metrics.getLatLonToPixelXY(state.center.lat, state.center.lon, lod);
            const scale = state.scale;
            const rect = this.getRectangle(pixelCenterXY, display?.displayWidth ?? 0, display?.displayHeight ?? 0, scale, state.azimuth);

            // compute the bounds of tile xy
            let nwTileXY = metrics.getPixelXYToTileXY(rect.xmin, rect.ymin);
            let seTileXY = metrics.getPixelXYToTileXY(rect.xmax, rect.ymax);

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
