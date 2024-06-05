import { ITileProvider } from "../../tiles.interfaces";
import { IImageTileMapLayerOptions } from "../tiles.map.interfaces";
import { AbstractTileMapLayerBuilder } from "../tiles.map.layer.builder";
import { ImageLayer, ImageLayerContentType } from "./tiles.map.layer.image";
export declare class ImageLayerBuilder extends AbstractTileMapLayerBuilder<ImageLayerContentType, ImageLayer> {
    constructor(name?: string, provider?: ITileProvider<ImageLayerContentType>);
    withOptions(options?: IImageTileMapLayerOptions): AbstractTileMapLayerBuilder<ImageLayerContentType, ImageLayer>;
    build(): ImageLayer;
}
