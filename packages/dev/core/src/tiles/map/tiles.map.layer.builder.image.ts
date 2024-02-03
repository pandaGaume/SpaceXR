import { ITileProvider, IsTileProviderBuilder } from "../tiles.interfaces";
import { IImageTileMapLayerOptions } from "./tiles.map.interfaces";
import { AbstractTileMapLayerBuilder } from "./tiles.map.layer.builder";
import { ImageLayer } from "./tiles.map.layer.image";

export class ImageLayerBuilder extends AbstractTileMapLayerBuilder<HTMLImageElement, ImageLayer> {
    public constructor(name?: string, provider?: ITileProvider<HTMLImageElement>) {
        super(name, provider);
    }

    public withOptions(options?: IImageTileMapLayerOptions): AbstractTileMapLayerBuilder<HTMLImageElement, ImageLayer> {
        if (options?.alpha) this._alpha = options?.alpha !== undefined ? Math.min(Math.max(options?.alpha, 0), 1.0) : 1.0; // default is opaque
        return super.withOptions(options);
    }

    public build(): ImageLayer {
        if (!this._provider) {
            throw new Error("No provider or provider builder defined");
        }
        const o = {
            zindex: this._zindex ?? -1,
            alpha: this._alpha ?? 1.0,
            zoomOffset: this._zoomOffset,
            attribution: this._attribution,
        };
        if (IsTileProviderBuilder<HTMLImageElement>(this._provider)) {
            const p = this._provider?.build();
            return new ImageLayer(this._name ?? "", p, o, this._enabled);
        }
        return new ImageLayer(this._name ?? "", this._provider, o, this._enabled);
    }
}
