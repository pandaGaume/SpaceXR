import { IVectorTileContent, IVectorTileLayer } from "./tiles.vector.interfaces";

export class VectorTileContent implements IVectorTileContent {
    _layers: Record<string, IVectorTileLayer> = {};

    public constructor(layers: Record<string, IVectorTileLayer>) {
        this._layers = layers;
    }

    public get layers(): Record<string, IVectorTileLayer> {
        return this._layers;
    }
}
