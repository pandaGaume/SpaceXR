import { ICanvasRenderingContext, ICanvasRenderingOptions } from "../../../engine";
import { ITileAddress, ITileDatasource, ITileProvider } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
export type ImageLayerContentType = HTMLImageElement | ImageData;
export declare class ImageLayer extends TileMapLayer<ImageLayerContentType> implements IImageTileMapLayer {
    _alpha: number;
    _background?: string;
    constructor(name: string, provider: ITileProvider<ImageLayerContentType> | ITileDatasource<ImageLayerContentType, ITileAddress>, options?: IImageTileMapLayerOptions, enabled?: boolean);
    get alpha(): number;
    set alpha(alpha: number);
    get background(): string | undefined;
    set background(b: string | undefined);
    draw(ctx: ICanvasRenderingContext, options?: ICanvasRenderingOptions): void;
}
