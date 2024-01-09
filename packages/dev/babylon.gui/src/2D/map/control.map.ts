import { ICanvasRenderingContext } from "@babylonjs/core";
import { Measure } from "@babylonjs/gui";
import { EventState, Observable, Observer, PropertyChangedEventArgs } from "core/events";
import { IGeo2 } from "core/geography";
import { Scalar } from "core/math";
import { ITileDisplay, ITileNavigationState, ITileSystemBounds, TileNavigationState } from "core/tiles";
import { ITileMap, ITileMapLayer } from "core/tiles/map";
import { TileSystemBounds } from "core/tiles/tile.system";
import { Nullable } from "core/types";
import { DisplayControl } from "./control.display";

export type ControlTileContentType = HTMLImageElement;

export class MapControl extends DisplayControl implements ITileMap<ControlTileContentType> {
    _layerAddedObservable?: Observable<ITileMapLayer<ControlTileContentType>>;
    _layerRemovedObservable?: Observable<ITileMapLayer<ControlTileContentType>>;

    protected _display: Nullable<ITileDisplay> = null;
    protected _navigation: ITileNavigationState;
    protected _layers?: Map<string, ITileMapLayer<ControlTileContentType>>;

    // internal
    protected _orderedLayers?: ITileMapLayer<ControlTileContentType>[];
    protected _background = "";

    _navigationUpdatedObserver?: Nullable<Observer<ITileNavigationState>>;
    _displayPropertyObserver?: Nullable<Observer<PropertyChangedEventArgs<ITileDisplay, unknown>>>;

    /// <summary>
    /// Create a new tile map.
    /// <param name="name">The map name.</param>
    /// <param name="display">The map display.</param>
    /// <param name="pipeline">The underlying pipeline. May be a Pipeline object or a PipelineBuilder. If Ommitedn pipeline is created unsing _buildDefaultPipeline() function which may be ovverided.</param>
    /// <param name="nav">The optional navigation api. May be a NavigationAPI object or a ITileMetrics object. In the second case, it will build a new TileNavigation(metrics).
    //  </param>
    /// </summary>
    public constructor(name: string, nav?: ITileNavigationState) {
        super(name);
        this._bindDisplay(this);

        // build the navigation state according parameters
        nav = nav ?? new TileNavigationState();
        this._navigation = nav;
        this._bindNavigation(this._navigation);
    }

    public get background(): string {
        return this._background;
    }

    public set background(value: string) {
        if (this._background === value) {
            return;
        }
        this._background = value;
        this._markAsDirty();
    }

    public get layerAddedObservable(): Observable<ITileMapLayer<ControlTileContentType>> {
        if (!this._layerAddedObservable) this._layerAddedObservable = new Observable<ITileMapLayer<ControlTileContentType>>();
        return this._layerAddedObservable;
    }

    public get layerRemovedObservable(): Observable<ITileMapLayer<ControlTileContentType>> {
        if (!this._layerRemovedObservable) this._layerRemovedObservable = new Observable<ITileMapLayer<ControlTileContentType>>();
        return this._layerRemovedObservable;
    }

    public get display(): Nullable<ITileDisplay> {
        return this._display;
    }

    public get navigation(): ITileNavigationState {
        return this._navigation;
    }

    public *getLayers(predicate?: (l: ITileMapLayer<ControlTileContentType>) => boolean, sorted: boolean = true): IterableIterator<ITileMapLayer<ControlTileContentType>> {
        if (sorted) {
            yield* this.getOrderedLayers(predicate);
            return;
        }

        if (this._layers) {
            if (predicate) {
                for (const layer of this._layers.values()) {
                    if (predicate(layer)) yield layer;
                }
            } else {
                yield* this._layers.values();
            }
        }
    }

    public *getOrderedLayers(predicate?: (l: ITileMapLayer<ControlTileContentType>) => boolean): IterableIterator<ITileMapLayer<ControlTileContentType>> {
        if (this._orderedLayers) {
            if (predicate) {
                for (const layer of this._orderedLayers ?? []) {
                    if (predicate(layer)) yield layer;
                }
            } else {
                yield* this._orderedLayers ?? [];
            }
        }
    }

    public addLayer(layer: ITileMapLayer<ControlTileContentType>): void {
        if (!this._layers) this._layers = new Map<string, ITileMapLayer<ControlTileContentType>>();
        if (layer.name && !this._layers.has(layer.name)) {
            this._layers.set(layer.name, layer);
            this._addSortedLayer(layer);
            this._updateNavigationBounds();
            this.markAsDirty();
            // we give the hand to other components
            this._onLayerAdded(layer);
            if (this._layerAddedObservable && this._layerAddedObservable.hasObservers()) {
                this._layerAddedObservable.notifyObservers(layer, -1, this, this);
            }
        }
    }

    public removeLayer(layer: ITileMapLayer<ControlTileContentType>): void {
        if (this._layers && layer.name && this._layers.has(layer.name)) {
            this._layers.delete(layer.name);
            this._removeSortedLayer(layer);
            this._updateNavigationBounds();
            this.markAsDirty();
            // we give the hand to other components
            this._onLayerRemoved(layer);
            if (this._layerRemovedObservable && this._layerRemovedObservable.hasObservers()) {
                this._layerRemovedObservable.notifyObservers(layer, -1, this, this);
            }
        }
    }

    public dispose() {
        this._navigationUpdatedObserver?.disconnect();
        this._displayPropertyObserver?.disconnect();
        super.dispose();
    }

    // navigation proxy
    public setView(center?: IGeo2 | Array<number>, zoom?: number, rotation?: number): MapControl {
        this._navigation.setView(center, zoom, rotation).validate();
        return this;
    }

    public zooming(delta: number): MapControl {
        this._navigation.zooming(delta).validate();
        return this;
    }

    public zoomIn(delta: number): MapControl {
        this._navigation.zoomIn(delta).validate();
        return this;
    }

    public zoomOut(delta: number): MapControl {
        this._navigation.zoomOut(delta).validate();
        return this;
    }

    public translatePixel(tx: number, ty: number): MapControl {
        this._navigation.translatePixel(tx, ty).validate();
        return this;
    }

    public translate(lat: IGeo2 | Array<number> | number, lon?: number): MapControl {
        this._navigation.translate(lat, lon).validate();
        return this;
    }

    public rotate(r: number): MapControl {
        this._navigation.rotate(r).validate();
        return this;
    }
    // end navigation proxy
    private _addSortedLayer(layer: ITileMapLayer<ControlTileContentType>): void {
        if (!this._orderedLayers) this._orderedLayers = [];
        this._orderedLayers.push(layer);
        this._orderedLayers.sort((a, b) => a.zindex - b.zindex); // sort by zindex
    }

    private _removeSortedLayer(layer: ITileMapLayer<ControlTileContentType>): void {
        if (this._orderedLayers) {
            const index = this._orderedLayers.findIndex((l) => l === layer);
            if (index !== -1) {
                this._orderedLayers.splice(index, 1);
            }
        }
    }

    private _onNavigationUpdated(event: ITileNavigationState, state: EventState): void {
        this.markAsDirty();
    }

    private _onDisplayPropertyChanged(event: PropertyChangedEventArgs<ITileDisplay, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "size": {
                this.markAsDirty();
                this._onDisplayResized(event.source);
                break;
            }
            case "position": {
                this.markAsDirty();
                this._onDisplayTranslated(event.source);
                break;
            }
            default: {
                break;
            }
        }
    }

    private _bindDisplay(display: Nullable<ITileDisplay>): void {
        if (display) {
            this._display = display;
            this._displayPropertyObserver = this._display.propertyChangedObservable.add(this._onDisplayPropertyChanged.bind(this));
        }
        this.markAsDirty();
        this._onDisplayBinded(display);
    }

    private _bindNavigation(nav?: ITileNavigationState): void {
        if (nav) {
            this._navigationUpdatedObserver = this._navigation.stateChangedObservable.add(this._onNavigationUpdated.bind(this));
        }
        this.markAsDirty();
        this._onNavigationBinded(nav);
    }

    private _updateNavigationBounds(): void {
        // first get the overall bounds for all the layers
        let b: Nullable<ITileSystemBounds> = null;
        for (const layer of this.getLayers()) {
            if (b === null) {
                b = new TileSystemBounds(layer.metrics);
                continue;
            }
            b.unionInPlace(layer.metrics);
        }
        // the assign the bounds to the navigation state
        if (b != null) {
            this._navigation.bounds.maxLOD = b.maxLOD;
            this._navigation.bounds.minLOD = b.minLOD;
            this._navigation.bounds.maxLatitude = b.maxLatitude;
            this._navigation.bounds.minLatitude = b.minLatitude;
            this._navigation.bounds.maxLongitude = b.maxLongitude;
            this._navigation.bounds.minLongitude = b.minLongitude;
        }
    }

    /// <summary>
    /// Draw the map on the canvas.
    /// </summary>
    public _draw(ctx: ICanvasRenderingContext, invalidatedRectangle?: Nullable<Measure>): void {
        if (!ctx || !this._display) {
            return;
        }
        ctx.save();

        // clear the canvas
        const res = this._display;
        if (this._background) {
            ctx.fillStyle = this._background;
            ctx.fillRect(res.x, res.y, res.width, res.height);
        } else {
            ctx.clearRect(res.x, res.y, res.width, res.height);
        }

        if (!this._orderedLayers || !this._orderedLayers.length) {
            ctx.restore();
            return;
        }

        const scale = this.navigation.scale;
        // we move the reference to the center of the display
        ctx.translate(res.x + res.width / 2, res.y + res.height / 2);
        // we scale the canvas according the navigation scale
        ctx.scale(scale, scale);
        // we rotate the canvas according the navigation azimuth
        if (this.navigation.azimuth?.value) {
            // convert azimuth to canvas rotation, which is clockwize, and cartesian
            const angle = this.navigation.azimuth.value * Scalar.DEG2RAD;
            ctx.rotate(angle);
        }
        // every tiles are supposed to got the same size here, using same metrics
        for (const l of this._orderedLayers ?? []) {
            if (l.enabled) {
                ctx.globalAlpha = l.alpha;
                this._drawLayer(ctx, l);
            }
        }
        ctx.restore();
    }

    /// <summary>
    /// Draw the layer on the canvas. This method is messaged from the draw method.
    /// </summary>
    protected _drawLayer(ctx: ICanvasRenderingContext, layer: ITileMapLayer<ControlTileContentType>): void {
        const provider = layer.provider;
        const tiles = provider.activTiles;
        if (!tiles || !tiles.count) {
            return;
        }
        const metrics = provider.metrics;
        const center = metrics.getLatLonToPixelXY(this.navigation.center.lat, this.navigation.center.lon, this.navigation.lod);

        for (const t of tiles) {
            if (t.rect) {
                const x = t.rect.x - center.x;
                const y = t.rect.y - center.y;
                const item = t.content ?? null; // trick to address erroness tile.
                if (item) {
                    if (item instanceof HTMLImageElement) {
                        ctx.drawImage(item, x, y);
                        continue;
                    }
                }
            }
        }
    }

    protected _onDisplayUnbinded(display: Nullable<ITileDisplay>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onDisplayBinded(display: Nullable<ITileDisplay>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onNavigationUnbinded(nav?: ITileNavigationState): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onNavigationBinded(nav?: ITileNavigationState): void {
        /* nothing to do here - overrided by subclasses */
    }
    protected _onDisplayResized(display: ITileDisplay): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onDisplayTranslated(display: ITileDisplay): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onLayerAdded(layer: ITileMapLayer<ControlTileContentType>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onLayerRemoved(layer: ITileMapLayer<ControlTileContentType>): void {
        /* nothing to do here - overrided by subclasses */
    }
}
