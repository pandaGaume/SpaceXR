import { PropertyChangedEventArgs, EventState, Observable, Observer } from "../../events";
import { ITileAddress, ITileDisplay, ITileMetrics } from "../tiles.interfaces";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipelineLink, ITileView } from "./tiles.pipeline.interfaces";
import { TileAddress } from "../address";
import { Nullable } from "../../types";
import { ICartesian2, IRectangle, Rectangle, Cartesian2 } from "../../geometry";
import { ITileNavigationState } from "../navigation";
import { TilePipelineLink } from "./tiles.pipeline.link";
import { EPSG3857 } from "../geography";

export class TileView implements ITileView {
    _addedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _removedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _updatedObservable?: Observable<IPipelineMessageType<ITileAddress>>;

    _activ: Map<string, ITileAddress> = new Map<string, ITileAddress>();
    _state: Nullable<ITileNavigationState> = null;
    _zoffset: number;
    _stateObserver: Nullable<Observer<ITileNavigationState>> = null;
    _display: Nullable<ITileDisplay> = null;
    _displayObserver: Nullable<Observer<PropertyChangedEventArgs<ITileDisplay, unknown>>> = null;

    _metrics: ITileMetrics;

    // internal pipeline links
    _links: Array<ITilePipelineLink<ITileAddress>> = [];

    // cached values
    _id: string;

    public constructor(id: string, metrics?: ITileMetrics, display?: Nullable<ITileDisplay>, state?: ITileNavigationState, zoffset: number = 0) {
        this._id = id;
        this._metrics = metrics ?? EPSG3857.Shared;
        this._zoffset = zoffset;
        // set the properties using defined setters
        this.display = display ?? null;
        this.state = state ?? null;
    }

    public get zoffset(): number {
        return this._zoffset;
    }

    public get name(): string {
        return this._id;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get state(): Nullable<ITileNavigationState> {
        return this._state;
    }

    public set state(state: Nullable<ITileNavigationState>) {
        if (this._state !== state) {
            if (this._state) {
                this._stateObserver?.disconnect();
                this._stateObserver = null;
                this._doClearContext(this._state, true);
            }
            this._state = state;
            if (this._state) {
                this._stateObserver = this._state.stateChangedObservable.add(this._onStateChanged.bind(this));
                this._doValidateContext(this._state, this._display, true); // force context to be validated if we change of api.
            }
        }
    }

    public get display(): Nullable<ITileDisplay> {
        return this._display;
    }

    public set display(display: Nullable<ITileDisplay>) {
        if (this._display !== display) {
            if (this._display) {
                this._displayObserver?.disconnect();
                this._displayObserver = null;
                this._doClearContext(this._state, true);
            }
            this._display = display;
            if (this._display) {
                this._displayObserver = this._display.propertyChangedObservable.add(this._onDisplayPropertyChanged.bind(this));
                this._doValidateContext(this._state, this._display, true); // force context to be validated if we change of api.
            }
        }
    }

    public dispose(): void {
        // dispose relation with the navigation state
        this._state = null;
        this._stateObserver?.disconnect();
        this._stateObserver = null;

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

    public setContext(state: Nullable<ITileNavigationState>, display: Nullable<ITileDisplay>, dispatchEvent: boolean): void {
        this._doValidateContext(state, display, dispatchEvent);
    }

    // INTERNALS
    private _onStateChanged(eventData: ITileNavigationState, eventState: EventState) {
        this._doValidateContext(eventData, this._display, true);
    }

    private _onDisplayPropertyChanged(event: PropertyChangedEventArgs<ITileDisplay, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "size": {
                this._doValidateContext(this._state, this._display, true);
                break;
            }
            default: {
                break;
            }
        }
    }

    // TODO : Introduce lod context for each zoffset... the idea is to limit the zoom level for each zoffset at the metrics max & min lod.
    // ALSO : Find a way to limit the navigation state to a specific lod range, as a navigation state MAY be shared by several views or pipelines...
    private _doValidateContext(state: Nullable<ITileNavigationState>, display: Nullable<ITileDisplay>, dispatchEvent: boolean = true) {
        if (state && this._display) {
            this._doValidateContextWithOffset(state, display, this._zoffset, dispatchEvent);
        }
    }

    private _doValidateContextWithOffset(state: ITileNavigationState, display: Nullable<ITileDisplay>, zoomOffset: number, dispatchEvent: boolean) {
        const metrics = this.metrics;
        const lod = TileAddress.ClampLod(state.lod + zoomOffset, metrics);
        const pixelCenterXY = metrics.getLatLonToPixelXY(state.center.lat, state.center.lon, lod);
        const scale = state.scale;
        const rect = this.getRectangle(pixelCenterXY, display?.width ?? 0, display?.height ?? 0, scale);

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

    private getRectangle(center: ICartesian2, w: number, h: number, scale: number): IRectangle {
        w = w / scale;
        h = h / scale;
        const x0 = center.x - w / 2;
        const y0 = center.y - h / 2;
        let bounds = new Rectangle(x0, y0, w, h);
        // bounds.points is returning a new set of points, so we need to rotate them if azimuth is non zero.
        return this._state?.azimuth ? Rectangle.FromPoints(...this.rotatePointsArround(center, ...bounds.points())) : bounds;
    }

    private *rotatePointsArround(center: ICartesian2, ...points: ICartesian2[]): IterableIterator<ICartesian2> {
        for (const p of points) {
            yield this.rotatePointArround(p.x, p.y, center, p);
        }
    }

    private rotatePointArround<R extends ICartesian2>(x: number, y: number, center: ICartesian2, target?: R): R {
        const r = target || Cartesian2.Zero();
        const translatedX = x - center.x;
        const translatedY = y - center.y;
        const cos = this._state?.azimuth?.cos ?? 1;
        const sin = this._state?.azimuth?.sin ?? 0;
        r.x = translatedX * cos - translatedY * sin + center.x;
        r.y = translatedX * sin + translatedY * cos + center.y;
        return <R>r;
    }
}
