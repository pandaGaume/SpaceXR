import { IMapDisplay } from "./map";
import { ISize3 } from "../geometry/geometry.interfaces";
import { Size3 } from "../geometry/geometry.size";

export class CanvasDisplay implements IMapDisplay {
    public constructor(public canvas: HTMLCanvasElement) {
        this.resizeToDisplaySize();
    }

    public getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null {
        return this.canvas.getContext("2d", options);
    }

    public get resolution(): ISize3 {
        return new Size3(this.canvas.width, this.canvas.height, 0);
    }

    /**
     * Check what size that element is being displayed (clientWidth & clientHeight properties) and then adjust
     * its drawingbuffer size (width & height properties) to match.
     * Let's call this function just before we render so it will always adjust the canvas to our desired size just before drawing.
     * @returns
     */
    public resizeToDisplaySize(scale: number = 1): boolean {
        // Lookup the size the browser is displaying the canvas in CSS pixels.
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;

        // Set actual size in memory (scaled to account for extra pixel density).
        const ratio = window.devicePixelRatio;
        const w = displayWidth * ratio * scale;
        const h = displayHeight * ratio * scale;

        if (this.canvas.width != w || this.canvas.height != h) {
            // Make the canvas the same size
            this.canvas.width = w;
            this.canvas.height = h;
            return true;
        }
        return false;
    }
}
