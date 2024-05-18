import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { ITilePipeline, ITilePipelineBuilder, IsTilePipelineBuilder } from "../pipeline/tiles.pipeline.interfaces";
import { ITileDisplayBounds, ITileMap, ITileMapBuilder, ITileMapLayer, ITileMapLayerBuilder, IsTileMapLayerBuilder } from "./tiles.map.interfaces";

export abstract class AbstractTileMapBuilder<T, L extends ITileMapLayer<T>> implements ITileMapBuilder<T, L> {
    protected _name?: string;
    protected _display?: ITileDisplayBounds;
    protected _navigation?: ITileNavigationState;
    protected _pipeline?: ITilePipeline<T> | ITilePipelineBuilder<T>;
    protected _layers?: Map<string, L>;

    public withName(name: string): ITileMapBuilder<T, L> {
        this._name = name;
        return this;
    }

    public withDisplay(display: ITileDisplayBounds): ITileMapBuilder<T, L> {
        this._display = display;
        return this;
    }

    public withNavigation(navigation: ITileNavigationState): ITileMapBuilder<T, L> {
        this._navigation = navigation;
        return this;
    }

    public withPipeline(pipeline: ITilePipeline<T> | ITilePipelineBuilder<T>): ITileMapBuilder<T, L> {
        this._pipeline = pipeline;
        return this;
    }

    public withLayer(...layer: (L | ITileMapLayerBuilder<T, L>)[]): ITileMapBuilder<T, L> {
        this._layers = this._layers ?? new Map<string, L>();
        layer.forEach((l) => {
            if (l.name && !this._layers?.has(l.name)) {
                if (IsTileMapLayerBuilder<T, L>(l)) {
                    this._layers!.set(l.name, l.build());
                } else {
                    this._layers!.set(l.name, l);
                }
            }
        });
        return this;
    }

    public get pipeline(): ITilePipeline<T> | undefined {
        if (IsTilePipelineBuilder<T>(this._pipeline)) {
            return this._pipeline.build();
        }
        return this._pipeline;
    }

    /// <summary>
    /// Build the tile map. This is where all the logic is implemented to build specific use case map, 2D, 3D with DEM or not, etc.
    /// </summary>
    public abstract build(): ITileMap<T, L, unknown> | undefined;
}
