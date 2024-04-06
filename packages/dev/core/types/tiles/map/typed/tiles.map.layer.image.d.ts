import { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas";
import { ITile, ITileAddress, ITileDatasource, ITileProvider } from "../../tiles.interfaces";
import { IImageTileMapLayer, IImageTileMapLayerOptions } from "../tiles.map.interfaces";
import { TileMapLayer } from "../tiles.map.layer";
export declare class ImageLayer extends TileMapLayer<HTMLImageElement> implements IImageTileMapLayer {
    _alpha: number;
    _background?: string;
    constructor(name: string, provider: ITileProvider<HTMLImageElement> | ITileDatasource<HTMLImageElement, ITileAddress>, options?: IImageTileMapLayerOptions, enabled?: boolean);
    get alpha(): number;
    set alpha(alpha: number);
    get background(): string | undefined;
    set background(b: string | undefined);
    draw(ctx: ICanvasRenderingContext, tiles?: Iterable<ITile<HTMLImageElement>>): void;
}
