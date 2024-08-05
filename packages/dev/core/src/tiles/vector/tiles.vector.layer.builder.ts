import { VectorTileFeatureBuilder } from "./tiles.vector.feature.builder";
import { IVectorTileFeature, IVectorTileLayer } from "./tiles.vector.interfaces";
import { VectorTileLayer } from "./tiles.vector.layer";

export class VectorTileLayerBuilder {
    _version?: number;
    _name: string;
    _extent?: number;
    _features: Array<IVectorTileFeature> = [];

    public constructor(name: string) {
        this._name = name;
    }

    public withVersion(value: number): VectorTileLayerBuilder {
        this._version = value;
        return this;
    }

    public withName(value: string): VectorTileLayerBuilder {
        this._name = value;
        return this;
    }
    public withExtends(value: number): VectorTileLayerBuilder {
        this._extent = value;
        return this;
    }

    public withFeature(value: IVectorTileFeature | VectorTileFeatureBuilder): VectorTileLayerBuilder {
        if (value instanceof VectorTileFeatureBuilder) {
            this._features.push(value.build());
            return this;
        }

        this._features.push(value);
        return this;
    }

    public withFeatures(...values: Array<IVectorTileFeature | VectorTileFeatureBuilder>): VectorTileLayerBuilder {
        for (const value of values) {
            this.withFeature(value);
        }
        return this;
    }

    public clear(): VectorTileLayerBuilder {
        this._features = [];
        return this;
    }

    public build(id?: number): IVectorTileLayer {
        return new VectorTileLayer(this._name, this._extent, this._version, ...this._features);
    }
}
