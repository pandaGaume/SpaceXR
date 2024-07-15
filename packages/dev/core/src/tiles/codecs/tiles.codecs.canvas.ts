import { ICanvasRenderingContext } from "../../engine";
import { ISize2 } from "../../geometry";
import { Nullable } from "../../types";
import { ITileCodec } from "../tiles.interfaces";

export abstract class CanvasTileCodec<T> implements ITileCodec<ImageBitmap>, ISize2 {
    private _canvas: HTMLCanvasElement;

    public constructor(canvas: HTMLCanvasElement) {
        this._canvas = canvas;
    }
    public get width(): number {
        return this._canvas.width;
    }

    public get height(): number {
        return this._canvas.height;
    }

    public async decodeAsync(r: void | Response): Promise<Awaited<Nullable<ImageBitmap>>> {
        if (r instanceof Response) {
            const data = await this._decodeDataAsync(r);
            if (data) {
                const workingContext = this._canvas?.getContext("2d", { willReadFrequently: true }) as ICanvasRenderingContext;
                if (!workingContext) {
                    throw new Error("Unable to get 2d context");
                }
                this._render(workingContext, data);
                const imgData = workingContext.getImageData(0, 0, this._canvas.width, this._canvas.height);
                return await createImageBitmap(imgData);
            }
        }
        return null;
    }

    protected abstract _decodeDataAsync(r: Response): Promise<Awaited<Nullable<T>>>;

    protected abstract _render(ctx: ICanvasRenderingContext, r: T): void;
}
