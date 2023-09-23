import { Nullable } from "core/types";
import { ITileMetrics } from "./tiles.interfaces";
import { AbstractTileCruncher } from "./tiles.crunchers";

export class ImageDataTileCruncher extends AbstractTileCruncher<ImageData> {
    private static CreateCanvas(width: number, height: number): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    // we need two canvas, one for the source and one for the target.
    private _source: HTMLCanvasElement;
    private _target: HTMLCanvasElement;

    public constructor(metrics: ITileMetrics) {
        super(metrics);
        const s = metrics.tileSize;
        this._source = ImageDataTileCruncher.CreateCanvas(s, s);
        this._target = ImageDataTileCruncher.CreateCanvas(s, s);
    }

    public Downsampling(childs: ImageData[]): Nullable<ImageData> {
        // assume the order of the childs is top-left, top-right, bottom-left, bottom-right.
        const sourceCtx = this._source.getContext("2d");
        const targetCtx = this._target.getContext("2d");
        if (sourceCtx && targetCtx) {
            for (let i = 0; i != 4; i++) {
                const c = childs[i];
                sourceCtx.putImageData(c, 0, 0);
                const section = this._sections[i];
                targetCtx.drawImage(this._source, section.x, section.y, section.width, section.height);
            }
            const size = this._metrics.tileSize;
            return targetCtx.getImageData(0, 0, size, size);
        }
        return null;
    }

    public Upsampling(parent: ImageData, sectionIndex: number): Nullable<ImageData> {
        const sourceCtx = this._source.getContext("2d");
        const targetCtx = this._target.getContext("2d");
        const section = this._sections[sectionIndex];
        if (sourceCtx && targetCtx) {
            sourceCtx.putImageData(parent, 0, 0);
            const size = this._metrics.tileSize;
            targetCtx.imageSmoothingEnabled = true;
            targetCtx.drawImage(this._source, section.x, section.y, section.width, section.height, 0, 0, size, size);
            return targetCtx.getImageData(0, 0, size, size);
        }
        return null;
    }
}
