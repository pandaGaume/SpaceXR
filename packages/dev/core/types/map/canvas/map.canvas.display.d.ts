import { Display } from "../../tiles";
export declare class CanvasDisplay extends Display {
    canvas: HTMLCanvasElement;
    static CreateCanvas(width: number, height: number): HTMLCanvasElement;
    static ResizeToDisplaySize(canvas: HTMLCanvasElement, scale?: number): boolean;
    _resizeObserver: ResizeObserver;
    _scale: number;
    _resizeToFitClient: boolean;
    constructor(canvas: HTMLCanvasElement, scale?: number, resizeToFitClient?: boolean);
    getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null;
    dispose(): void;
}
