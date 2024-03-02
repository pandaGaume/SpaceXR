import { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";
import { ITileAddress, ITileDatasource, ITileProvider } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
export declare class ImageLayer extends TileMapLayer<HTMLImageElement> implements IImageTileMapLayer {
    _alpha: number;
    constructor(name: string, provider: ITileProvider<HTMLImageElement> | ITileDatasource<HTMLImageElement, ITileAddress>, options?: IImageTileMapLayerOptions, enabled?: boolean);
    get alpha(): number;
    set alpha(alpha: number);
    draw(ctx: ICanvasRenderingContext): void;
}
