import { Nullable } from "core/types";
import { ITileSection, ITileCruncher, ITileMetrics } from "./tiles.interfaces";
export declare class ImageDataTileCruncher implements ITileCruncher<ImageData> {
    private static CreateCanvas;
    private _source;
    private _target;
    private _metrics;
    private _sections;
    constructor(metrics: ITileMetrics);
    Donwsampling(childs: ImageData[], sections?: ITileSection[]): Nullable<ImageData>;
    Upsampling(parent: ImageData, section: ITileSection | number): Nullable<ImageData>;
    private _buildSections;
}
