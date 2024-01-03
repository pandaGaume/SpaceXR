import { ITileMap } from "../../tiles/map/tiles.map.interfaces";
import { AbstractTileMapBuilder } from "../../tiles/map/tiles.map.builder";
import { CanvasTileContentType, CanvasTileMapOptions } from "./map.canvas";
export declare class CanvasTileMapBuilder extends AbstractTileMapBuilder<CanvasTileContentType> {
    _options?: CanvasTileMapOptions;
    constructor(options?: CanvasTileMapOptions);
    withOptions(o: CanvasTileMapOptions): CanvasTileMapBuilder;
    build(): ITileMap<CanvasTileContentType> | undefined;
}
