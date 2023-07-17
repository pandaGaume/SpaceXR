import { IRectangle } from "../geometry/geometry.interfaces";
import { CanvasController, ICanvasView } from "./canvas/controller.canvas";
import { RGBAColor } from "../math/math.color";
import { IEnvelope, Nullable } from "..";
export declare class GeodeticGridPainter {
    static DefaultColor: RGBAColor;
    static Default: GeodeticGridPainter;
    paint<V>(ctx: CanvasRenderingContext2D, rect: IRectangle, src: CanvasController<V>, bounds: IEnvelope): void;
}
export declare class GeodeticGridViewOptions {
    static Default: GeodeticGridViewOptions;
    painters?: Array<Nullable<GeodeticGridPainter>>;
}
export declare class GeodeticGridView implements ICanvasView {
    _o: GeodeticGridViewOptions;
    constructor(options: GeodeticGridViewOptions);
    invalidateContent<V>(ctx: CanvasRenderingContext2D, rect: IRectangle, src: CanvasController<V>): void;
}
