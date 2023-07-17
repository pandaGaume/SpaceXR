import { IRectangle } from "../geometry/geometry.interfaces";
import { CanvasController, ICanvasView } from "./canvas/controller.canvas";
import { RGBAColor } from "../math/math.color";
import { IEnvelope, Nullable } from "..";

export class GeodeticGridPainter {
    public static DefaultColor = new RGBAColor(38, 222, 255);

    public static Default = new GeodeticGridPainter();

    public paint<V>(ctx: CanvasRenderingContext2D, rect: IRectangle, src: CanvasController<V>, bounds: IEnvelope) {}
}

export class GeodeticGridViewOptions {
    public static Default = new GeodeticGridViewOptions();

    // patterns according level of detail
    painters?: Array<Nullable<GeodeticGridPainter>>;
}

export class GeodeticGridView implements ICanvasView {
    _o: GeodeticGridViewOptions;

    public constructor(options: GeodeticGridViewOptions) {
        this._o = { ...GeodeticGridViewOptions.Default, ...options };
    }

    public invalidateContent<V>(ctx: CanvasRenderingContext2D, rect: IRectangle, src: CanvasController<V>): void {
        const envelope = src.view?.bounds;
        if (envelope) {
            const painter = (this._o.painters ? this._o.painters[src.levelOfDetail] : GeodeticGridPainter.Default) || GeodeticGridPainter.Default;
            painter.paint(ctx, rect, src, envelope);
        }
    }
}
