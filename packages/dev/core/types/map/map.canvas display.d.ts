import { IMapDisplay } from "./map";
import { ISize3 } from "../geometry/geometry.interfaces";
export declare class CanvasDisplay implements IMapDisplay {
    canvas: HTMLCanvasElement;
    constructor(canvas: HTMLCanvasElement);
    getContext(options?: CanvasRenderingContext2DSettings | undefined): CanvasRenderingContext2D | null;
    get resolution(): ISize3;
    resizeToDisplaySize(scale?: number): boolean;
}
