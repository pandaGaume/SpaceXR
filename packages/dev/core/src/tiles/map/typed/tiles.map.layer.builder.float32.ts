import { ITileProvider, IsTileProviderBuilder } from "../../tiles.interfaces";
import { AbstractTileMapLayerBuilder } from "../tiles.map.layer.builder";
import { Float32Layer } from "./tiles.map.layer.float32";

export class Float32LayerBuilder extends AbstractTileMapLayerBuilder<Float32Array, Float32Layer> {
    public constructor(name?: string, provider?: ITileProvider<Float32Array>) {
        super(name, provider);
    }

    public build(): Float32Layer {
        if (!this._provider) {
            throw new Error("No provider or provider builder defined");
        }
        const o = {
            zindex: this._zindex ?? -1,
            zoomOffset: this._zoomOffset,
            attribution: this._attribution,
        };
        const p = IsTileProviderBuilder<Float32Array>(this._provider) ? this._provider?.build() : this._provider;
        return new Float32Layer(this._name ?? "", p, o, this._enabled);
    }
}
