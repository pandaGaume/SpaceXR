import { ITileProvider } from "../../tiles.interfaces";
import { AbstractTileMapLayerBuilder } from "../tiles.map.layer.builder";
import { Float32Layer } from "./tiles.map.layer.float32";
export declare class Float32LayerBuilder extends AbstractTileMapLayerBuilder<Float32Array, Float32Layer> {
    constructor(name?: string, provider?: ITileProvider<Float32Array>);
    build(): Float32Layer;
}
