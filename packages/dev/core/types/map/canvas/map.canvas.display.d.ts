import { TileDisplay } from "../../tiles/display/tiles.display";
export declare class CanvasDisplay extends TileDisplay {
    canvas: HTMLCanvasElement;
    static ResizeToDisplaySize(canvas: HTMLCanvasElement, scale?: number): boolean;
    _resizeObserver: ResizeObserver;
    _scale: number;
    constructor(canvas: HTMLCanvasElement, x?: number, y?: number, w?: number, h?: number, scale?: number);
    getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null;
    dispose(): void;
}
