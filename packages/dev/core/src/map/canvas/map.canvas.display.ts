import { TileDisplay } from "../../tiles";

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

    _resizeObserver: ResizeObserver;
    _scale: number;
    _resizeToFitClient: boolean;

    public constructor(public canvas: HTMLCanvasElement, scale?: number, resizeToFitClient?: boolean) {
        const f = resizeToFitClient == undefined || resizeToFitClient == true;
        if (f) {
            // the canvas width and height are the buffer size of the canvas. default values are width:300, height:150.
            // the canvas clientWidth and clientHeight are the size of the canvas in the browser window.
            // so we need to adapt the buffer size to the client size.
            CanvasDisplay.ResizeToDisplaySize(canvas, scale);
        }
        super(canvas.width, canvas.height);
        this._scale = scale ?? 1;
        this._resizeToFitClient = f;
        this._resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                // Check if the resized element is our canvas
                if (entry.target === canvas) {
                    if (f) {
                        CanvasDisplay.ResizeToDisplaySize(canvas, this._scale);
                    }
                    this.resize(canvas.width, canvas.height);
                }
            }
        });
        this._resizeObserver.observe(canvas);
    }

    public getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null {
        return this.canvas.getContext("2d", options);
    }

    public dispose(): void {
        super.dispose();
        this._resizeObserver.disconnect();
    }
}
