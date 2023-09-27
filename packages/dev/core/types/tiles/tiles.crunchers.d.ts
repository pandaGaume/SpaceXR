import { Nullable } from "core/types";
import { ITileSection, ITileCruncher, ITileMetrics } from "./tiles.interfaces";
export declare abstract class AbstractTileCruncher<T> implements ITileCruncher<T> {
    protected _metrics: ITileMetrics;
    protected _sections: ITileSection[];
    constructor(metrics: ITileMetrics);
    abstract Downsampling(childs: T[]): Nullable<T>;
    abstract Upsampling(parent: T, sectionIndex: number): Nullable<T>;
    private _buildSections;
}
