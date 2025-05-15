export interface IGestureSource<T> {}

export enum GestureStatus {
    IDLE = 0,
    STARTED = 1,
}

export type TouchMapGestureEventName = "gesturestart" | "gestureend" | "gestureupdate";

export type TouchMapGestureType = "drag" | "rotate" | "zoom" | "tap";

export class TouchSpot {
    id: any;
    x: number = 0;
    y: number = 0;
    timestamp: number = 0;

    public constructor(spot?: TouchSpot) {
        if (spot) {
            this.id = spot.id;
            this.x = spot.x;
            this.y = spot.y;
            this.timestamp = spot.timestamp;
        }
    }
}

export class TouchMapEvent extends Event {
    public eventSource: TouchEvent;
    public gestureType: TouchMapGestureType;

    constructor(eventSource: TouchEvent, gestureType: TouchMapGestureType, name: TouchMapGestureEventName) {
        super(name);
        this.eventSource = eventSource;
        this.gestureType = gestureType;
    }

    public preventDefault() {
        this.eventSource?.preventDefault();
    }
}

export class TouchMapStartEvent extends TouchMapEvent {
    constructor(eventSource: TouchEvent, gestureType: TouchMapGestureType, name?: TouchMapGestureEventName) {
        super(eventSource, gestureType, name ?? "gesturestart");
    }
}

export class TouchMapEndEvent extends TouchMapEvent {
    constructor(eventSource: TouchEvent, gestureType: TouchMapGestureType, name?: TouchMapGestureEventName) {
        super(eventSource, gestureType, name ?? "gestureend");
    }
}

export class TouchMapUpdateEvent extends TouchMapEvent {
    public touchesA: Array<TouchSpot>;
    public touchesB: Array<TouchSpot>;

    constructor(eventSource: TouchEvent, gestureType: TouchMapGestureType, touchesA: Array<TouchSpot>, touchesB: Array<TouchSpot>, name?: TouchMapGestureEventName) {
        super(eventSource, gestureType, name ?? "gestureupdate");
        this.touchesA = touchesA;
        this.touchesB = touchesB ?? touchesA;
    }
}

export interface ITouchGestureOptions {
    touchCount: number;
}
