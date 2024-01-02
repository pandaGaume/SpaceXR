import { TileDisplay } from "../../tiles/display/tiles.display";

export class CanvasDisplay extends TileDisplay {
    /**
     * Check what size that element is being displayed (clientWidth & clientHeight properties) and then adjust
     * its drawingbuffer size (width & height properties) to match.
     * Let's call this function just before we render so it will always adjust the canvas to our desired size just before drawing.
     * @returns
     */
    public static ResizeToDisplaySize(canvas: HTMLCanvasElement, scale: number = 1): boolean {
        // Lookup the size the browser is displaying the canvas in CSS pixels.
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        // Set actual size in memory (scaled to account for extra pixel density).
        const ratio = window.devicePixelRatio;
        const w = displayWidth * ratio * scale;
        const h = displayHeight * ratio * scale;

        if (canvas.width != w || canvas.height != h) {
            // Make the canvas the same size
            canvas.width = w;
            canvas.height = h;
            return true;
        }
        return false;
    }

    public constructor(public canvas: HTMLCanvasElement, x?: number, y?: number, w?: number, h?: number) {
        super(x ?? 0, y ?? 0, w ?? canvas.width, h ?? canvas.height);
    }

    public getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null {
        return this.canvas.getContext("2d", options);
    }
}
