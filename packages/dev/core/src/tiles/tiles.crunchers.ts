import { Nullable } from "core/types";
import { ITileSection, ITileCruncher, ITileMetrics } from "./tiles.interfaces";

export abstract class AbstractTileCruncher<T> implements ITileCruncher<T> {
    protected _metrics: ITileMetrics;
    protected _sections: ITileSection[] = [];

    public constructor(metrics: ITileMetrics) {
        if (metrics === undefined) throw new Error("metrics cannot be undefined");
        this._metrics = metrics;
        this._buildSections();
    }

    abstract Downsampling(childs: T[]): Nullable<T>;
    abstract Upsampling(parent: T, sectionIndex: number): Nullable<T>;

    private _buildSections(): void {
        const s = this._metrics.tileSize / 2;
        this._sections.push({ x: 0, y: 0, width: s, height: s });
        this._sections.push({ x: s, y: 0, width: s, height: s });
        this._sections.push({ x: 0, y: s, width: s, height: s });
        this._sections.push({ x: s, y: s, width: s, height: s });
    }
}
