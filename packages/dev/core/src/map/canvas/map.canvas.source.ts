import { ICanvasRenderingContext, ICanvasRenderingOptions } from "../../engine";
import { EventState, Observer, PropertyChangedEventArgs } from "../../events";
import { IEnvelope } from "../../geography";
import { Cartesian2 } from "../../geometry";
import { RGBAColor } from "../../math";
import { ITile, ITileMetrics, ITileMetricsProvider, TileCollection, TileConsumerBase } from "../../tiles";
import { ITileMapLayer, ITileMapLayerContainer } from "../../tiles/map";
import { Nullable } from "../../types";
import { CanvasTileContentType } from "./map.canvas";
import { CanvasDisplay } from "./map.canvas.display";

type CanvasProducerContentType = HTMLImageElement | ImageData;

class LayerView {
    constructor(
        public layer: ITileMapLayer<CanvasTileContentType>,
        public tiles: TileCollection<CanvasTileContentType>,
        public propertyChangedObserver: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>> = null
    ) {}
}

export class CanvasTileSource<L extends ITileMapLayer<CanvasTileContentType>>
    extends TileConsumerBase<CanvasProducerContentType>
    implements ICanvasRenderingOptions, ITileMetricsProvider
{
    public static DefaultBackground = RGBAColor.LightGray();

    public static DefaultOptions: ICanvasRenderingOptions = {
        background: CanvasTileSource.DefaultBackground.toHexString(),
    };

    _target: ITile<ImageData>;
    _metrics: ITileMetrics;

    // layer management
    _layers: ITileMapLayerContainer<CanvasTileContentType, L>;
    _layerAddedObservable?: Nullable<Observer<L>>;
    _layerRemovedObservable?: Nullable<Observer<L>>;

    // list of active tile by ordered layers
    _activeTiles: Array<LayerView> = Array<LayerView>();

    // display
    _display: CanvasDisplay;
    _context: Nullable<CanvasRenderingContext2D>;

    _background?: string;
    _alpha: number;

    public constructor(name: string, layers: ITileMapLayerContainer<HTMLImageElement, L>, target: ITile<ImageData>, metrics: ITileMetrics, options?: ICanvasRenderingOptions) {
        super(name, false);
        this._layers = layers;
        this._layerAddedObservable = this._layers.layerAddedObservable.add(this._onLayerAdded.bind(this));
        this._layerRemovedObservable = this._layers.layerRemovedObservable.add(this._onLayerRemoved.bind(this));

        this._target = target;
        this._metrics = metrics;

        this._display = this._buildDisplay();
        this._context = this._display.getContext();

        this._background = options?.background;
        this._alpha = options?.alpha ?? 1;

        // finally add existing layers
        for (const layer of this._layers.getLayers()) {
            this._onLayerAdded(layer);
        }
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

    public get bounds(): IEnvelope | undefined {
        return this._target?.bounds;
    }

    protected _onLayerAdded(layer: L): void {
        layer.linkTo(this);
        const view = new LayerView(layer, new TileCollection());
        this._activeTiles.push(view);
        this._activeTiles.sort((a, b) => a.layer.zindex - b.layer.zindex);
        const bounds = this.bounds;
        if (bounds) {
            for (const tile of layer.activTiles) {
                if (tile.bounds && tile.bounds.intersects(bounds)) {
                    view.tiles.add(tile);
                    this.invalidate();
                }
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

    protected _onBeforeTileAdded(eventData: Array<ITile<CanvasTileContentType>>, eventState: EventState): void {
        /* we are overriding this method to prevent the default behavior of invalidate before every operation */
    }

    protected _onTileAdded(eventData: Array<ITile<CanvasTileContentType>>, eventState: EventState): void {
        const bounds = this.bounds;
        if (bounds) {
            const layer = this._activeTiles.find((v) => v.layer === eventState.currentTarget);
            if (layer) {
                for (const tile of eventData) {
                    if (tile.bounds && tile.bounds.overlaps(bounds)) {
                        // do something with the tile
                        layer.tiles.add(tile);
                        this.invalidate();
                    }
                }
            }
        }
    }

    protected _onBeforeTileRemoved(eventData: Array<ITile<CanvasTileContentType>>, eventState: EventState): void {
        /* we are overriding this method to prevent the default behavior of invalidate before every operation */
    }

    protected _onTileRemoved(eventData: Array<ITile<CanvasTileContentType>>, eventState: EventState): void {
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

    protected _onBeforeTileUpdated(eventData: Array<ITile<CanvasTileContentType>>, eventState: EventState): void {
        /* we are overriding this method to prevent the default behavior of invalidate before every operation */
    }

    protected _onTileUpdated(eventData: Array<ITile<CanvasTileContentType>>, eventState: EventState): void {
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
            const w = res.displayWidth;
            const h = res.displayHeight;
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
        const w = res.displayWidth;
        const h = res.displayHeight;

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

        for (const tiles of this._activeTiles) {
            if (!tiles.layer.enabled) {
                continue;
            }

            const layerLod = tiles.layer.navigation.lod;
            const tileLod = this._target.address.levelOfDetail;
            const dlod = layerLod - tileLod;

            if (dlod == 0) {
                // fast track - rect is in pixel at given LOD.
                const sx = this._target.rect?.x ?? 0;
                const sy = this._target.rect?.y ?? 0;
                for (const t of tiles.tiles) {
                    if (t.rect) {
                        const x = t.rect.x - sx;
                        const y = t.rect.y - sy;
                        const item = t.content ?? null; // trick to address erroness tile.
                        if (item) {
                            ctx.drawImage(item, 0, 0, item.width, item.height, x, y, item.width + 1, item.height + 1);
                            continue;
                        }

                        var size = tiles.layer.metrics.tileSize;
                        ctx.fillRect(x, y, size, size);
                    }
                }
                continue;
            }

            const scale = dlod < 0 ? 1 << dlod : 1 / (1 << dlod);

            const ref = Cartesian2.Zero();
            const sx = this._target.rect?.x ?? 0;
            const sy = this._target.rect?.y ?? 0;

            for (const t of tiles.tiles) {
                const geo = t.bounds;
                if (!geo) {
                    continue;
                }
                this.metrics.getLatLonToPointXYToRef(geo.north, geo.west, tileLod, ref);

                const x = ref.x - sx;
                const y = ref.y - sy;
                const item = t.content ?? null; // trick to address erroness tile.
                if (item) {
                    const w = Math.ceil(item.width * scale);
                    const h = Math.ceil(item.height * scale);
                    ctx.drawImage(item, 0, 0, item.width, item.height, x, y, w, h);
                    continue;
                }
                var size = tiles.layer.metrics.tileSize;
                ctx.fillRect(x, y, size, size);
            }
        }
        ctx.restore();
    }

    protected _buildDisplay(canvas?: HTMLCanvasElement): CanvasDisplay {
        canvas = canvas ?? CanvasDisplay.CreateCanvas(this._metrics.tileSize, this._metrics.tileSize);
        return new CanvasDisplay(canvas as HTMLCanvasElement, 1, false);
    }
}
