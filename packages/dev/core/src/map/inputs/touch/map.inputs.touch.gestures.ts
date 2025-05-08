import { GestureStatus, ITouchGestureOptions, TouchMapEndEvent, TouchMapGestureType, TouchMapStartEvent, TouchMapUpdateEvent, TouchSpot } from "./map.inputs.touch.interfaces";

export class TouchMapGesture {
    static X_coordinate: number = 0;
    static Y_coordinate: number = 1;

    private _element: HTMLElement | SVGElement | null;
    protected _options: any;
    protected _gestureType: TouchMapGestureType;
    protected _touchesA: Array<TouchSpot>;
    protected _touchesB: Array<TouchSpot>;
    protected _status: GestureStatus;

    constructor(element: HTMLElement | SVGElement | string, gestureType: TouchMapGestureType, options?: ITouchGestureOptions) {
        this._element = typeof element == "string" ? document.getElementById(element) : element;

        if (this._element) {
            this._element.addEventListener("touchstart", this.start.bind(this), false);
            this._element.addEventListener("touchmove", this.move.bind(this), false);
            this._element.addEventListener("touchend", this.end.bind(this), false);
            this._element.addEventListener("touchcancel", this.cancel.bind(this), false);
        }
        this._gestureType = gestureType;
        this._options = options || { touchCount: 1 };
        this._touchesA = Array.from({ length: this._options.touchCount }, () => new TouchSpot());
        this._touchesB = Array.from({ length: this._options.touchCount }, () => new TouchSpot());
        this._status = GestureStatus.IDLE;
    }

    start(e: Event): void {
        e.preventDefault();
        var evt = e as TouchEvent;
        if (!evt.touches || evt.touches.length != this._options.touchCount) {
            return;
        }
        this._doStart(evt);
    }

    protected _doStart(evt: TouchEvent) {
        this.update(evt);
        this._status = GestureStatus.STARTED;
        this.fireEvent(this.buildStartEvent(evt));
    }

    move(e: Event) {
        e.preventDefault();
        var evt = e as TouchEvent;
        if (!evt.touches || evt.touches.length != this._options.touchCount) {
            return;
        }
        this._doMove(evt);
    }

    protected _doMove(evt: TouchEvent) {
        // swap A & B
        this.swap();
        this.update(evt);
        this.fireEvent(this.buildUpdateEvent(evt));
    }

    end(e: Event) {
        e.preventDefault();
        var evt = e as TouchEvent;
        let l1 = evt.touches?.length ?? 0;
        let l2 = evt.changedTouches?.length ?? 0;
        var totalLength = l1 + l2;
        if (totalLength >= this._options.touchCount) {
            this._doEnd(evt);
        }
    }

    protected _doEnd(evt: TouchEvent) {
        this.clear();
        this._status = GestureStatus.IDLE;
        this.fireEvent(this.buildEndEvent(evt));
    }

    cancel(e: Event) {
        e.preventDefault();
        this.clear();
        this._status = GestureStatus.IDLE;
    }

    protected fireEvent(e?: Event): void {
        if (e) {
            this._element?.dispatchEvent(e);
        }
    }

    protected update(evt: TouchEvent) {
        let now = Date.now();
        let count = evt.touches.length;
        for (let i = 0; i < count; i++) {
            let touch = evt.touches[i];
            let localTouch = this._touchesB[i];
            localTouch.id = touch.identifier;
            localTouch.x = touch.clientX;
            localTouch.y = touch.clientY;
            localTouch.timestamp = now;
        }
    }

    protected clear() {}

    protected swap() {
        var tmp = this._touchesB;
        this._touchesB = this._touchesA;
        this._touchesA = tmp;
    }

    protected buildStartEvent(evt: TouchEvent): Event | undefined {
        return new TouchMapStartEvent(evt, this._gestureType);
    }

    protected buildUpdateEvent(evt: TouchEvent): Event | undefined {
        return new TouchMapUpdateEvent(
            evt,
            this._gestureType,
            this._touchesA.map((v) => new TouchSpot(v)),
            this._touchesB.map((v) => new TouchSpot(v))
        );
    }

    protected buildEndEvent(evt: TouchEvent): Event | undefined {
        return new TouchMapEndEvent(evt, this._gestureType);
    }
}
