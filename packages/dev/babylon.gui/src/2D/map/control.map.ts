import { ICanvasRenderingContext } from "@babylonjs/core";
import { Control, Measure } from "@babylonjs/gui";
import { EventState, Observable, Observer } from "core/events";
import { IGeo2 } from "core/geography";
import { Scalar } from "core/math";
import { ITileNavigationState, ITileSystemBounds, TileNavigationState, ITileMap, ITileMapLayer, TileSystemBounds, ITileDisplay } from "core/tiles";
import { Nullable } from "core/types";

export type ControlTileContentType = HTMLImageElement;

export class MapControl extends Control implements ITileMap<ControlTileContentType>, ITileDisplay {
    _layerAddedObservable?: Observable<ITileMapLayer<ControlTileContentType>>;
    _layerRemovedObservable?: Observable<ITileMapLayer<ControlTileContentType>>;

    protected _navigation: ITileNavigationState;
    protected _layers?: Map<string, ITileMapLayer<ControlTileContentType>>;

    // internal
    protected _orderedLayers?: ITileMapLayer<ControlTileContentType>[];
    protected _background = "";

    _navigationUpdatedObserver?: Nullable<Observer<ITileNavigationState>>;

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

        // build the navigation state according parameters
        nav = nav ?? new TileNavigationState();
        this._navigation = nav;
        this._bindNavigation(this._navigation);
    }

    public get displayHeight(): number {
        return this._currentMeasure.height;
    }

    public get displayWidth(): number {
        return this._currentMeasure.width;
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
            layer.callback = (v) => {
                if (!v) this.markAsDirty();
            };
            layer.setContext(this._navigation, this);
            //this.markAsDirty();

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
            layer.callback = undefined;
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

    private _onNavigationUpdatedInternal(event: ITileNavigationState, state: EventState): void {
        this._updateLayersContext();
        this._onNavigationUpdated(event);
    }

    private _updateLayersContext(): void {
        for (const layer of this.getLayers()) {
            layer.setContext(this._navigation, this);
        }
    }
    private _bindNavigation(nav?: ITileNavigationState): void {
        if (nav) {
            this._navigationUpdatedObserver = this._navigation.stateChangedObservable.add(this._onNavigationUpdatedInternal.bind(this));
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
        if (!ctx) {
            return;
        }
        ctx.save();

        // clear the canvas
        const res = this._currentMeasure;
        if (this._background) {
            ctx.fillStyle = this._background;
            ctx.fillRect(res.left, res.top, res.width, res.height);
        } else {
            ctx.clearRect(res.left, res.top, res.width, res.height);
        }

        if (!this._orderedLayers || !this._orderedLayers.length) {
            ctx.restore();
            return;
        }

        const scale = this.navigation.scale;
        // we move the reference to the center of the display
        ctx.translate(res.left + res.width / 2, res.top + res.height / 2);
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
        const tiles = layer.getActiveTiles();
        if (!tiles || !tiles.count) {
            return;
        }
        const metrics = layer.metrics;
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

    protected _onNavigationUnbinded(nav?: ITileNavigationState): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onNavigationBinded(nav?: ITileNavigationState): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onLayerAdded(layer: ITileMapLayer<ControlTileContentType>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onLayerRemoved(layer: ITileMapLayer<ControlTileContentType>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onNavigationUpdated(event: ITileNavigationState): void {}
}
