import { PropertyChangedEventArgs } from "../../../events";
import { ITileAddress, ITileDatasource, ITileProvider } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";

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
                const args = new PropertyChangedEventArgs<ImageLayer, unknown>(this, oldValue, this._alpha, "background");
                this._propertyChangedObservable.notifyObservers(args, -1, this, this);
                return;
            }
            this._background = b;
        }
    }
}
