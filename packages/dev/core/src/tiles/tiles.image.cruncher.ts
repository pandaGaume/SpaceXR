import { Nullable } from "core/types";
import { ITileSection, ITileCruncher, ITileMetrics } from "./tiles.interfaces";

export class ImageDataTileCruncher implements ITileCruncher<ImageData> {
    private static CreateCanvas(width: number, height: number): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    // we need two canvas, one for the source and one for the target.
    private _source: HTMLCanvasElement;
    private _target: HTMLCanvasElement;
    private _metrics: ITileMetrics;
    private _sections: ITileSection[] = [];

    public constructor(metrics: ITileMetrics) {
        if (metrics === undefined) throw new Error("metrics cannot be undefined");
        this._metrics = metrics;
        const s = metrics.tileSize;
        this._source = ImageDataTileCruncher.CreateCanvas(s, s);
        this._target = ImageDataTileCruncher.CreateCanvas(s, s);
        // build the sections cache.
        this._buildSections();
    }

    public Downsampling(childs: ImageData[], sections?: ITileSection[]): Nullable<ImageData> {
        // assume the order of the childs is top-left, top-right, bottom-left, bottom-right.
        const sourceCtx = this._source.getContext("2d");
        const targetCtx = this._target.getContext("2d");
        sections = sections || this._sections;
        if (sourceCtx && targetCtx) {
            for (let i = 0; i != 4; i++) {
                const c = childs[i];
                sourceCtx.putImageData(c, 0, 0);
                const section = sections[i];
                targetCtx.drawImage(this._source, section.x, section.y, section.width, section.height);
            }
            const size = this._metrics.tileSize;
            return targetCtx.getImageData(0, 0, size, size);
        }
        return null;
    }

    public Upsampling(parent: ImageData, section: ITileSection | number): Nullable<ImageData> {
        const sourceCtx = this._source.getContext("2d");
        const targetCtx = this._target.getContext("2d");
        section = typeof section === "number" ? this._sections[section] : section;
        if (sourceCtx && targetCtx) {
            sourceCtx.putImageData(parent, 0, 0);
            const size = this._metrics.tileSize;
            targetCtx.imageSmoothingEnabled = true;
            targetCtx.drawImage(this._source, section.x, section.y, section.width, section.height, 0, 0, size, size);
            return targetCtx.getImageData(0, 0, size, size);
        }
        return null;
    }

    private _buildSections(): void {
        const s = this._metrics.tileSize / 2;
        this._sections.push({ x: 0, y: 0, width: s, height: s });
        this._sections.push({ x: s, y: 0, width: s, height: s });
        this._sections.push({ x: 0, y: s, width: s, height: s });
        this._sections.push({ x: s, y: s, width: s, height: s });
    }
}
