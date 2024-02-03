import { PropertyChangedEventArgs } from "../../events";
import { ITileAddress, ITileDatasource, ITileProvider } from "../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions } from "./tiles.map.interfaces";
import { TileMapLayer } from "./tiles.map.layer";

export class ImageLayer extends TileMapLayer<HTMLImageElement> implements IImageTileMapLayer {
    _alpha: number;

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
}
