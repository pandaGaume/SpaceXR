import { TouchMapGesture } from "../map.inputs.touch.gestures";
import { ITouchGestureOptions } from "../map.inputs.touch.interfaces";

export class TouchMapZoomGesture extends TouchMapGesture {
    constructor(element: HTMLElement | SVGElement | string, options?: ITouchGestureOptions) {
        super(element, "zoom", options);
    }
    protected _doStart(evt: TouchEvent) {
        super._doStart(evt);
    }
    protected _doMove(evt: TouchEvent) {
        super._doMove(evt);
    }
    protected _doEnd(evt: TouchEvent) {
        super._doEnd(evt);
    }
}
