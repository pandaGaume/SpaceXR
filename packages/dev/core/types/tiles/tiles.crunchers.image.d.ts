import { Nullable } from "core/types";
import { ITileMetrics } from "./tiles.interfaces";
import { AbstractTileCruncher } from "./tiles.crunchers";
export declare class ImageDataTileCruncher extends AbstractTileCruncher<ImageData> {
    private static CreateCanvas;
    private _source;
    private _target;
    constructor(metrics: ITileMetrics);
    Downsampling(childs: ImageData[]): Nullable<ImageData>;
    Upsampling(parent: ImageData, sectionIndex: number): Nullable<ImageData>;
}
