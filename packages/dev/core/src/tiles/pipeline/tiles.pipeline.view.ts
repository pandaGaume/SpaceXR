import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITileAddress, ITileDisplay, ITileMetrics } from "../tiles.interfaces";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipelineLink, ITileView } from "./tiles.pipeline.interfaces";
import { TileAddress } from "../tiles.address";
import { Nullable } from "../../types";
import { PropertyChangedEventArgs } from "../../events/events.args";
import { ICartesian2, IRectangle, ISize2 } from "../../geometry/geometry.interfaces";
import { Rectangle } from "../../geometry/geometry.rectangle";
import { Cartesian2 } from "../../geometry/geometry.cartesian";
import { Scalar } from "../../math/math";
import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { TilePipelineLink } from "./tiles.pipeline.link";

export class TileView implements ITileView {
    /**
     * Keep an azimuth angle within the range of 0 to 360 degrees
     * @param a the azimuth value.
     * @returns the clampled value.
     */
    public static ClampAzimuth(a: number): number {
        // the modulo operator (%) is used to get the remainder when the azimuth is divided by 360.
        // Adding 360 to the result ensures that negative values are shifted into the positive range.
        // Finally, taking the modulo 360 of the sum ensures that values greater than 360 are wrapped
        // back to the range of 0 to 360.
        return ((a % 360) + 360) % 360;
    }

    _addressAddedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _addressRemovedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _addressUpdatedObservable?: Observable<IPipelineMessageType<ITileAddress>>;

    _activ: Map<string, ITileAddress> = new Map<string, ITileAddress>();
    _state: Nullable<ITileNavigationState> = null;
    _stateObserver: Nullable<Observer<ITileNavigationState>> = null;
    _azimuthObserver: Nullable<Observer<PropertyChangedEventArgs<ITileNavigationState, number>>> = null;
    _display: Nullable<ITileDisplay> = null;
    _displayObserver: Nullable<Observer<PropertyChangedEventArgs<ITileDisplay, ISize2>>> = null;
    _metrics: ITileMetrics;

    // internal pipeline links
    _links: Array<ITilePipelineLink<ITileAddress>> = [];

    // cached values
    _azimuth: number = 0;
    _cosAzimuth: number = 1;
    _sinAzimuth: number = 0;
    _id: string;

    public constructor(id: string, metrics: ITileMetrics, display?: ITileDisplay, state?: ITileNavigationState) {
        this._id = id;
        this._metrics = metrics;
        this.display = display ?? null;
        this.state = state ?? null;
    }

    public get id(): string {
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
                this._stateObserver?.dispose();
                this._stateObserver = null;
                this._azimuthObserver?.dispose();
                this._azimuthObserver = null;
                this._doClearContext(this._state, true);
            }
            this._state = state;
            if (this._state) {
                this._stateObserver = this._state.stateChangedObservable.add(this._onStateChanged.bind(this));
                this._azimuthObserver = this._state.azimuthObservable.add(this._onAzimuthChanged.bind(this));
                this._doValidateContext(this._state, true); // force context to be validated if we change of api.
            }
        }
    }

    public get display(): Nullable<ITileDisplay> {
        return this._display;
    }

    public set display(display: Nullable<ITileDisplay>) {
        if (this._display !== display) {
            if (this._display) {
                this._displayObserver?.dispose();
                this._displayObserver = null;
                this._doClearContext(this._state, true);
            }
            this._display = display;
            if (this._display) {
                this._displayObserver = this._display.resizeObservable.add(this._onResize.bind(this));
                this._doValidateContext(this._state, true); // force context to be validated if we change of api.
            }
        }
    }

    public dispose(): void {
        // dispose relation with the navigation state
        this._state = null;
        this._stateObserver?.dispose();
        this._stateObserver = null;

        // dispose the links
        for (const l of this._links) {
            l.dispose();
        }
        this._links = [];
    }

    public get addedObservable(): Observable<IPipelineMessageType<ITileAddress>> {
        this._addressAddedObservable = this._addressAddedObservable || new Observable<IPipelineMessageType<ITileAddress>>();
        return this._addressAddedObservable!;
    }

    public get removedObservable(): Observable<IPipelineMessageType<ITileAddress>> {
        this._addressRemovedObservable = this._addressRemovedObservable || new Observable<IPipelineMessageType<ITileAddress>>();
        return this._addressRemovedObservable!;
    }

    public get updatedObservable(): Observable<IPipelineMessageType<ITileAddress>> {
        this._addressUpdatedObservable = this._addressUpdatedObservable || new Observable<IPipelineMessageType<ITileAddress>>();
        return this._addressUpdatedObservable!;
    }

    public linkTo(target: ITargetBlock<ITileAddress>, options?: ILinkOptions): void {
        // a view may be linked to several targets, so we need to keep track of them.
        if (this._links.findIndex((l) => l.target === target) === -1) {
            const link = new TilePipelineLink(this, target, options);
            this._links.push(link);
        }
    }

    // INTERNALS
    protected _onStateChanged(eventData: ITileNavigationState, eventState: EventState) {
        this._doValidateContext(eventData, true);
    }

    protected _onAzimuthChanged(eventData: PropertyChangedEventArgs<ITileNavigationState, number>, eventState: EventState) {
        // this is a bit tricky, we need to update the cached values to avoid computing them each time.
        // this event occur always before onStateChanged, so we can safely update the cached values.
        var azimuth = eventData.newValue ?? 0;
        let clamped = TileView.ClampAzimuth(azimuth) * Scalar.DEG2RAD;
        this._cosAzimuth = Math.cos(clamped);
        this._sinAzimuth = Math.sin(clamped);
    }

    protected _onResize(eventData: PropertyChangedEventArgs<ITileDisplay, ISize2>, eventState: EventState) {
        this._doValidateContext(this._state, true);
    }

    protected _doValidateContext(state: Nullable<ITileNavigationState>, dispatchEvent: boolean = true) {
        if (state && this._display) {
            const metrics = this.metrics;
            const center = state.center;
            const lod = Scalar.Clamp(Math.round(state.zoom), this.metrics.minLOD, this.metrics.maxLOD);
            const pixelCenterXY = metrics.getLatLonToPixelXY(center.lat, center.lon, lod);
            const scale = TileAddress.GetLodScale(state.zoom);
            const rect = this.getRectangle(pixelCenterXY, scale);

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
                if (added.length && this._addressAddedObservable?.hasObservers()) {
                    this._addressAddedObservable.notifyObservers(added, -1, this, this);
                }
                if (deleted.length && this._addressRemovedObservable?.hasObservers()) {
                    this._addressRemovedObservable.notifyObservers(deleted, -1, this, this);
                }
            }
        }
    }

    protected _doClearContext(state: Nullable<ITileNavigationState>, dispatchEvent: boolean = true) {
        if (state) {
            let deleted = Array.from(this._activ.values());
            this._activ.clear();

            if (dispatchEvent) {
                if (deleted.length && this._addressRemovedObservable?.hasObservers()) {
                    this._addressRemovedObservable.notifyObservers(deleted, -1, this, this);
                }
            }
        }
    }

    private getRectangle(center: ICartesian2, scale: number): IRectangle {
        const w = this._display?.width ?? 0 / scale;
        const h = this._display?.height ?? 0 / scale;
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
        r.x = translatedX * this._cosAzimuth - translatedY * this._sinAzimuth + center.x;
        r.y = translatedX * this._sinAzimuth + translatedY * this._cosAzimuth + center.y;
        return <R>r;
    }
}
