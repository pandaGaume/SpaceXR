import { ICanvasRenderingContext, ICanvasRenderingOptions } from "../../../engine";
import { PropertyChangedEventArgs } from "../../../events";
import { ITileAddress, ITileDatasource, ITileProvider } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
import { Context2DTileMap } from "../../../map/canvas";

export type ImageLayerContentType = HTMLImageElement | ImageData;

export class ImageLayer extends TileMapLayer<ImageLayerContentType> implements IImageTileMapLayer {
    _alpha: number;
    _background?: string;

    public constructor(
        name: string,
        provider: ITileProvider<ImageLayerContentType> | ITileDatasource<ImageLayerContentType, ITileAddress>,
        options?: IImageTileMapLayerOptions,
        enabled?: boolean
    ) {
        super(name, provider, options, enabled);
        this._alpha = options?.alpha !== undefined ? Math.min(Math.max(options?.alpha, 0), 1.0) : 1.0; // default is opaque
    }

    public get alpha(): number {
        return this._alpha;
    }

    public set alpha(alpha: number) {
        const a = Math.min(Math.max(alpha, 0), 1.0);
        if (this._alpha !== a) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._alpha;
                this._alpha = a;
                const args = new PropertyChangedEventArgs<ImageLayer, unknown>(this, oldValue, this._alpha, "alpha");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._alpha = a;
        }
    }

    public get background(): string | undefined {
        return this._background;
    }

    public set background(b: string | undefined) {
        if (this._background !== b) {
            if (this._propertyChangedObservable && this._propertyChangedObservable.hasObservers()) {
                const oldValue = this._background;
                this._background = b;
                const args = new PropertyChangedEventArgs<ImageLayer, unknown>(this, oldValue, this._background, "background");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._background = b;
        }
    }

    public draw(ctx: ICanvasRenderingContext, options?: ICanvasRenderingOptions): void {
        if (this.enabled && this.activTiles) {
            ctx.save();
            try {
                ctx.globalAlpha = this.alpha ?? options?.alpha ?? 1.0;
                ctx.fillStyle = this.background ?? options?.background ?? Context2DTileMap.DefaultBackground.toHexString();
                const center = this.metrics.getLatLonToPointXY(this.navigation.center.lat, this.navigation.center.lon, this.navigation.lod);

                for (const t of this.activTiles) {
                    const b = t.bounds;
                    if (b) {
                        const x = b.x - center.x;
                        const y = b.y - center.y;
                        const item = t.content ?? null;
                        if (item) {
                            const size = this.metrics.tileSize;
                            ctx.drawImage(item, 0, 0, item.width, item.height, x, y, size + 1, size + 1);
                            continue;
                        }
                    }
                }
            } finally {
                ctx.restore();
            }
        }
    }
}
