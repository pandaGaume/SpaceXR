import { TouchMapGesture } from "../map.inputs.touch.gestures";
import { ITouchGestureOptions } from "../map.inputs.touch.interfaces";

export interface ITouchTapGestureOptions extends ITouchGestureOptions {
    /** Max duration (ms) between touchstart and touchend to consider it a tap */
    tapTime?: number;
    /** Max distance (px) moved between start and end to consider it a tap */
    tapDistance?: number;
}

export class TouchMapTapGesture extends TouchMapGesture {
    private _startTime = 0;
    private _startX = 0;
    private _startY = 0;

    constructor(element: HTMLElement | SVGElement | string, options?: ITouchTapGestureOptions) {
        super(element, "tap", options);
    }

    protected _doStart(evt: TouchEvent) {
        super._doStart(evt);

        if (evt.touches.length !== 2) return;

        const t1 = evt.touches[0];
        const t2 = evt.touches[1];
        this._startTime = Date.now();
        this._startX = (t1.clientX + t2.clientX) / 2;
        this._startY = (t1.clientY + t2.clientY) / 2;
    }

    protected _doEnd(evt: TouchEvent) {
        super._doEnd(evt);

        const options = this._options as ITouchTapGestureOptions;
        const tapTime = options.tapTime ?? 400;
        const tapDistance = options.tapDistance ?? 25;

        if (evt.changedTouches.length !== 2) return;

        const now = Date.now();
        const dt = now - this._startTime;
        if (dt > tapTime) return;

        const t1 = evt.changedTouches[0];
        const t2 = evt.changedTouches[1];
        const endX = (t1.clientX + t2.clientX) / 2;
        const endY = (t1.clientY + t2.clientY) / 2;

        const dx = endX - this._startX;
        const dy = endY - this._startY;
        const dist = Math.hypot(dx, dy);

        if (dist <= tapDistance) {
            this._fire("tap", { x: endX, y: endY });
        }
    }

    protected _doMove(evt: TouchEvent) {
        super._doMove(evt);
        // You may choose to cancel the gesture here if moved too far
    }
}
