import { ICanvasRenderingContext, ICanvasRenderingOptions } from "../../engine";
import { EventState, Observer, PropertyChangedEventArgs } from "../../events";
import { IEnvelope, IGeoBounded } from "../../geography";
import { Cartesian2, ISize2 } from "../../geometry";
import { RGBAColor } from "../../math";
import { ITile, ITileAddress, ITileMetrics, ITileMetricsProvider, IsTileAddress, Tile, TileCollection, TileConsumerBase } from "../../tiles";
import { ITileMapLayer, ITileMapLayerContainer, ImageLayerContentType, isDrawableTileMapLayer } from "../../tiles/map";
import { Nullable } from "../../types";
import { CanvasDisplay } from "./map.canvas.display";

export type CanvasTileSourceTargetContentType = ImageLayerContentType;
export type CanvasTileSourceSourceContentType = any;

class LayerView {
    constructor(
        public layer: ITileMapLayer<CanvasTileSourceSourceContentType>,
        public tiles: TileCollection<CanvasTileSourceSourceContentType>,
        public propertyChangedObserver: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>> = null
    ) {}
}

export interface ICanvasTileSourceOptions extends ICanvasRenderingOptions {
    resolution?: ISize2;
    display?: HTMLCanvasElement | CanvasDisplay;
    debug?: boolean;
}

export class CanvasTileSource<L extends ITileMapLayer<CanvasTileSourceSourceContentType>>
    extends TileConsumerBase<CanvasTileSourceTargetContentType>
    implements ICanvasRenderingOptions, ITileMetricsProvider, IGeoBounded
{
    public static DefaultBackground = RGBAColor.LightGray();

    public static DefaultOptions: ICanvasRenderingOptions = {
        background: CanvasTileSource.DefaultBackground.toHexString(),
    };

    _target: ITile<ImageData>;
    _metrics: ITileMetrics;

    // layer management
    _layers: ITileMapLayerContainer<CanvasTileSourceSourceContentType, L>;
    _layerAddedObservable?: Nullable<Observer<L>>;
    _layerRemovedObservable?: Nullable<Observer<L>>;

    // list of active tile by ordered layers
    _activeTiles: Array<LayerView> = Array<LayerView>();

    // display
    _display: CanvasDisplay;
    _context: Nullable<CanvasRenderingContext2D>;

    _background?: string;
    _alpha: number;
    _debug: boolean;

    public constructor(
        name: string,
        layers: ITileMapLayerContainer<CanvasTileSourceSourceContentType, L>,
        target: ITile<ImageData> | ITileAddress,
        metrics: ITileMetrics,
        options?: ICanvasTileSourceOptions
    ) {
        super(name, false);
        this._layers = layers;
        this._layerAddedObservable = this._layers.layerAddedObservable.add(this._onLayerAdded.bind(this));
        this._layerRemovedObservable = this._layers.layerRemovedObservable.add(this._onLayerRemoved.bind(this));

        if (IsTileAddress(target)) {
            this._target = new Tile<ImageData>(target.x, target.y, target.levelOfDetail, null, metrics);
        } else {
            this._target = target;
        }
        this._metrics = metrics;

        this._display = this._buildDisplay(options);
        this._context = this._display.getContext({ willReadFrequently: true });

        this._background = options?.background;
        this._alpha = options?.alpha ?? 1;
        this._debug = options?.debug ?? false;

        // finally add existing layers
        for (const layer of this._layers.getLayers()) {
            this._onLayerAdded(layer);
        }
    }

    public get debug(): boolean {
        return this._debug;
    }

    public set debug(value: boolean) {
        this._debug = value;
    }

    public get target(): ITile<ImageData> {
        return this._target;
    }

    public get display(): CanvasDisplay {
        return this._display;
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get background(): string | undefined {
        return this._background;
    }

    public set background(v: string | undefined) {
        if (this._background !== v) {
            this._background = v;
            this.invalidate();
        }
    }

    public get alpha(): number {
        return this._alpha;
    }

    public set alpha(v: number) {
        if (this._alpha !== v) {
            this._alpha = v;
            this.invalidate();
        }
    }

    public get geoBounds(): IEnvelope | undefined {
        return this._target?.geoBounds;
    }

    protected _onLayerAdded(layer: L): void {
        layer.linkTo(this);
        const view = new LayerView(layer, new TileCollection());
        this._activeTiles.push(view);
        this._activeTiles.sort((a, b) => a.layer.zindex - b.layer.zindex);
        const bounds = this.geoBounds;
        if (bounds) {
            let needInvalidate = false;
            for (const tile of layer.activTiles) {
                const env = tile.geoBounds;
                if (env && env.intersects(bounds)) {
                    view.tiles.add(tile);
                    needInvalidate = true;
                }
            }
            if (needInvalidate) {
                this.invalidate();
            }
        }
        view.propertyChangedObserver = layer.propertyChangedObservable.add(this._onLayerPropertyChanged.bind(this));
    }

    protected _onLayerPropertyChanged(eventData: PropertyChangedEventArgs<unknown, unknown>, eventState: EventState): void {
        switch (eventData.propertyName) {
            case "zindex": {
                this._activeTiles.sort((a, b) => a.layer.zindex - b.layer.zindex);
                this.invalidate();
                break;
            }
            case "enabled": {
                this.invalidate();
                break;
            }
        }
    }

    protected _onLayerRemoved(layer: L): void {
        layer.unlinkFrom(this);
        const i = this._activeTiles.findIndex((v) => v.layer === layer);
        if (i !== -1) {
            const removed = this._activeTiles.splice(i, 1);
            removed[0].tiles.clear();
            removed[0].propertyChangedObserver?.disconnect();
            this.invalidate();
        }
    }

    public dispose(): void {
        super.dispose();
        this._layerAddedObservable?.disconnect();
        this._layerRemovedObservable?.disconnect();
        this._layerAddedObservable = null;
        this._layerRemovedObservable = null;
        for (const items of this._activeTiles) {
            items.layer.unlinkFrom(this);
            items.tiles.clear();
        }
    }

    protected _onBeforeTileAdded(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void {
        /* we are overriding this method to prevent the default behavior of invalidate before every operation */
    }

    protected _onTileAdded(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void {
        const bounds = this.geoBounds;
        if (bounds) {
            const layer = this._activeTiles.find((v) => v.layer === eventState.currentTarget);
            if (layer) {
                let needInvalidate = false;
                for (const tile of eventData) {
                    const env = tile.geoBounds;
                    if (env && env.intersects(bounds)) {
                        // do something with the tile
                        layer.tiles.add(tile);
                        needInvalidate = true;
                    }
                }
                if (needInvalidate) {
                    this.invalidate();
                }
            }
        }
    }

    protected _onBeforeTileRemoved(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void {
        /* we are overriding this method to prevent the default behavior of invalidate before every operation */
    }

    protected _onTileRemoved(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void {
        const layer = this._activeTiles.find((v) => v.layer === eventState.currentTarget);
        if (layer) {
            for (const tile of eventData) {
                if (layer.tiles.has(tile.address)) {
                    layer.tiles.remove(tile.address);
                    this.invalidate();
                }
            }
        }
    }

    protected _onBeforeTileUpdated(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void {
        /* we are overriding this method to prevent the default behavior of invalidate before every operation */
    }

    protected _onTileUpdated(eventData: Array<ITile<CanvasTileSourceSourceContentType>>, eventState: EventState): void {
        const layer = this._activeTiles.find((v) => v.layer === eventState.currentTarget);
        if (layer) {
            for (const tile of eventData) {
                if (layer.tiles.has(tile.address)) {
                    this.invalidate();
                }
            }
        }
    }

    protected _doValidate() {
        const ctx: ICanvasRenderingContext = this._getContext2D() as ICanvasRenderingContext;
        if (ctx) {
            const x = 0;
            const y = 0;
            this._draw(ctx, x, y);
            const res = this._display;
            const w = res.width;
            const h = res.height;
            this._target.content = ctx.getImageData(x, y, w, h);
        }
    }

    protected _afterValidate(): void {
        super._afterValidate();
        if (this._updatedObservable && this._updatedObservable.hasObservers()) {
            this._updatedObservable.notifyObservers([this._target], -1, this, this);
        }
    }

    protected _getContext2D(): Nullable<CanvasRenderingContext2D> {
        return this._context;
    }

    protected _draw(ctx: ICanvasRenderingContext, xoffset: number = 0, yoffset: number = 0): void {
        if (!ctx || !this._display) {
            return;
        }
        ctx.save();

        // clear the canvas
        const res = this._display;
        const x = xoffset;
        const y = yoffset;
        const w = res.width;
        const h = res.height;

        // we clear the canvas
        ctx.clearRect(x, y, w, h);

        if (!this._activeTiles || !this._activeTiles.length) {
            ctx.restore();
            return;
        }

        const a = this._alpha ?? 1;
        const b = this._background ?? CanvasTileSource.DefaultBackground.toHexString();

        ctx.fillStyle = b;
        ctx.globalAlpha = a;

        // here we need to adapt the scale between the desired resolution and the tile size.
        ctx.scale(this.display.width / this.metrics.tileSize, this.display.height / this.metrics.tileSize);

        for (const view of this._activeTiles) {
            if (!view.layer.enabled) {
                continue;
            }

            const layerLod = view.layer.navigation.lod;
            const tileLod = this._target.address.levelOfDetail;
            const dlod = layerLod - tileLod;

            let sx: number = 0;
            let sy: number = 0;

            if (dlod == 0) {
                let b = this._target.bounds;
                // fast track - rect is in pixel at given LOD.
                sx = b?.x ?? 0;
                sy = b?.y ?? 0;
                for (const t of view.tiles) {
                    b = t.bounds;
                    if (b) {
                        if (isDrawableTileMapLayer(view.layer)) {
                            view.layer.draw?.call(view.layer, ctx, sx, sy, t);
                            if (this._debug) {
                                view.layer.debug?.call(view.layer, ctx, sx, sy, t);
                            }
                            continue;
                        }
                        const x = b.x - sx;
                        const y = b.y - sy;

                        const item = t.content ?? null; // trick to address erroness tile.
                        if (item && (item instanceof ImageData || item instanceof HTMLImageElement)) {
                            ctx.drawImage(item, 0, 0, item.width, item.height, x, y, item.width + 1, item.height + 1);
                            continue;
                        }

                        var size = view.layer.metrics.tileSize;
                        ctx.fillRect(x, y, size, size);
                    }
                }
                continue;
            }

            const scale = dlod < 0 ? 1 << dlod : 1 / (1 << dlod);

            const ref = Cartesian2.Zero();
            sx = this._target.bounds?.x ?? 0;
            sy = this._target.bounds?.y ?? 0;

            for (const t of view.tiles) {
                const geo = t.geoBounds;
                if (!geo) {
                    continue;
                }
                this.metrics.getLatLonToPointXYToRef(geo.north, geo.west, tileLod, ref);

                const x = ref.x - sx;
                const y = ref.y - sy;

                if (isDrawableTileMapLayer(view.layer)) {
                    view.layer.draw?.call(view.layer, ctx, sx, sy, t, scale);
                    if (this._debug) {
                        view.layer.debug?.call(view.layer, ctx, sx, sy, t, scale);
                    }
                    continue;
                }

                const item = t.content ?? null; // trick to address erroness tile.
                if (item && (item instanceof ImageData || item instanceof HTMLImageElement)) {
                    const w = Math.ceil((item.width + 1) * scale);
                    const h = Math.ceil((item.height + 1) * scale);
                    ctx.drawImage(item, 0, 0, item.width, item.height, x, y, w, h);
                    continue;
                }
                var size = view.layer.metrics.tileSize;
                ctx.fillRect(x, y, size, size);
            }
        }
        ctx.restore();
    }

    protected _buildDisplay(options?: ICanvasTileSourceOptions): CanvasDisplay {
        if (options?.display) {
            if (options.display instanceof CanvasDisplay) {
                return options.display;
            }
            return new CanvasDisplay(options.display as HTMLCanvasElement, 1, false);
        }
        const canvas = CanvasDisplay.CreateCanvas(options?.resolution?.width ?? this._metrics.tileSize, options?.resolution?.height ?? this._metrics.tileSize);
        return new CanvasDisplay(canvas as HTMLCanvasElement, 1, false);
    }
}
