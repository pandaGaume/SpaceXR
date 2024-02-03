import { ITileProvider } from "../tiles.interfaces";
import { IImageTileMapLayerOptions } from "./tiles.map.interfaces";
import { AbstractTileMapLayerBuilder } from "./tiles.map.layer.builder";
import { ImageLayer } from "./tiles.map.layer.image";
export declare class ImageLayerBuilder extends AbstractTileMapLayerBuilder<HTMLImageElement, ImageLayer> {
    constructor(name?: string, provider?: ITileProvider<HTMLImageElement>);
    withOptions(options?: IImageTileMapLayerOptions): AbstractTileMapLayerBuilder<HTMLImageElement, ImageLayer>;
    build(): ImageLayer;
}
