import { Display } from "../../tiles";
export declare class CanvasDisplay extends Display {
    canvas: HTMLCanvasElement;
    static CreateCanvas(width: number, height: number): HTMLCanvasElement;
    /**
     * Check what size that element is being displayed (clientWidth & clientHeight properties) and then adjust
     * its drawingbuffer size (width & height properties) to match.
     * Let's call this function just before we render so it will always adjust the canvas to our desired size just before drawing.
     * @returns
     */
    static ResizeToDisplaySize(canvas: HTMLCanvasElement, scale?: number): boolean;
    _resizeObserver: ResizeObserver;
    _scale: number;
    _resizeToFitClient: boolean;
    constructor(canvas: HTMLCanvasElement, scale?: number, resizeToFitClient?: boolean);
    getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null;
    dispose(): void;
}
