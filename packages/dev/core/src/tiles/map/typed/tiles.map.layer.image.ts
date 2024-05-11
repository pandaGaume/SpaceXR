import { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";
import { PropertyChangedEventArgs } from "../../../events";
import { ITile, ITileAddress, ITileDatasource, ITileProvider } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
import { ICartesian2 } from "dev/core/src/geometry";

export class ImageLayer extends TileMapLayer<HTMLImageElement> implements IImageTileMapLayer {
    _alpha: number;
    _background?: string;

    public constructor(
        name: string,
        provider: ITileProvider<HTMLImageElement> | ITileDatasource<HTMLImageElement, ITileAddress>,
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
                const args = new PropertyChangedEventArgs<ImageLayer, unknown>(this, oldValue, this._alpha, "background");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._background = b;
        }
    }

    public draw(ctx: ICanvasRenderingContext, tiles?: Iterable<ITile<HTMLImageElement>>, center?: ICartesian2): void {
        tiles = tiles ?? this.activTiles;
        if (tiles == null || undefined) {
            return;
        }

        const metrics = this.metrics;
        center = center ?? metrics.getLatLonToPointXY(this.navigation.center.lat, this.navigation.center.lon, this.navigation.lod);

        for (const t of tiles) {
            if (t.rect) {
                const x = t.rect.x - center.x;
                const y = t.rect.y - center.y;
                const item = t.content ?? null; // trick to address erroness tile.
                if (item) {
                    if (item instanceof HTMLImageElement) {
                        ctx.drawImage(item, 0, 0, item.width, item.height, x, y, item.width + 1, item.height + 1);
                        continue;
                    }
                } else {
                    ctx.fillRect(x, y, metrics.tileSize, metrics.tileSize);
                }
            }
        }
    }
}
