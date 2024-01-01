import { ITileNavigationApi } from "../navigation/tiles.navigation.interfaces";
import { ITilePipeline, ITilePipelineBuilder } from "../pipeline/tiles.pipeline.interfaces";
import { ITileDisplay } from "../tiles.interfaces";
import { ITileMap, ITileMapBuilder, ITileMapLayer, ITileMapLayerBuilder, IsTileMapLayerBuilder } from "./tiles.map.interfaces";

export abstract class AbstractTileMapBuilder<T> implements ITileMapBuilder<T> {
    protected _name?: string;
    protected _display?: ITileDisplay;
    protected _navigation?: ITileNavigationApi;
    protected _pipeline?: ITilePipeline<T> | ITilePipelineBuilder<T>;
    protected _layers?: Map<string, ITileMapLayer<T>>;

    public withName(name: string): ITileMapBuilder<T> {
        this._name = name;
        return this;
    }

    public withDisplay(display: ITileDisplay): ITileMapBuilder<T> {
        this._display = display;
        return this;
    }

    public withNavigation(navigation: ITileNavigationApi): ITileMapBuilder<T> {
        this._navigation = navigation;
        return this;
    }

    public withPipeline(pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>): ITileMapBuilder<T> {
        this._pipeline = pipeline;
        return this;
    }

    public withLayer(...layer: (ITileMapLayer<T> | ITileMapLayerBuilder<T>)[]): ITileMapBuilder<T> {
        this._layers = this._layers ?? new Map<string, ITileMapLayer<T>>();
        layer.forEach((l) => {
            if (l.name && !this._layers?.has(l.name)) {
                if (IsTileMapLayerBuilder<T>(l)) {
                    this._layers!.set(l.name, l.build());
                } else {
                    this._layers!.set(l.name, l);
                }
            }
        });
        return this;
    }

    /// <summary>
    /// Build the tile map. This is where all the logic is implemented to build specific use case map, 2D, 3D with DEM or not, etc.
    /// </summary>
    public abstract build(): ITileMap<T>;
}
