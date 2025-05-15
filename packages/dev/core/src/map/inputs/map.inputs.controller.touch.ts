import { Observable } from "../../events";
import { ITapGesture, ISwipeGesture, IPinchGesture, TouchGestureType, AnyTouchGesture } from "./map.inputs.interfaces.touch";

interface PointerState {
    id: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    startTime: number;
}

export class PointerToGestureController<T> {
    public readonly onTouchObservable = new Observable<AnyTouchGesture>();

    private _pointers = new Map<number, PointerState>();
    private _lastTapTime = 0;
    private _pinchStartDistance = 0;

    onPointerOver(src: T, x: number, y: number, id?: number): void {
        throw new Error("Method not implemented.");
    }
    onPointerEnter(src: T, x: number, y: number, id?: number): void {
        throw new Error("Method not implemented.");
    }
    onPointerOut(src: T, x: number, y: number, id?: number): void {
        throw new Error("Method not implemented.");
    }
    onPointerLeave(src: T, x: number, y: number, id?: number): void {
        throw new Error("Method not implemented.");
    }
    onPointerDown(src: T, x: number, y: number, buttonIndex: number, id?: number): void {
        throw new Error("Method not implemented.");
    }
    onPointerUp(src: T, x: number, y: number, buttonIndex: number, id?: number): void {
        throw new Error("Method not implemented.");
    }
    onPointerMove(src: T, x: number, y: number, id?: number): void {
        throw new Error("Method not implemented.");
    }
    onPointerCancel(src: T, x: number, y: number, id?: number): void {
        throw new Error("Method not implemented.");
    }
    onPointerGotCapture(src: T, x: number, y: number, id?: number): void {
        throw new Error("Method not implemented.");
    }
    onPointerLostCapture(src: T, x: number, y: number, id?: number): void {
        throw new Error("Method not implemented.");
    }

    public onPointerDown = (e: PointerEvent) => {
        this._pointers.set(e.pointerId, {
            id: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
            startTime: performance.now(),
        });

        if (this._pointers.size === 2) {
            const [a, b] = Array.from(this._pointers.values());
            this._pinchStartDistance = this._distance(a, b);
        }
    };

    private _onPointerMove = (e: PointerEvent) => {
        const p = this._pointers.get(e.pointerId);
        if (p) {
            p.currentX = e.clientX;
            p.currentY = e.clientY;
        }

        if (this._pointers.size === 2) {
            const [a, b] = Array.from(this._pointers.values());
            const distance = this._distance(a, b);
            const scale = distance / this._pinchStartDistance;

            const gesture: IPinchGesture = {
                type: TouchGestureType.Pinch,
                timestamp: performance.now(),
                duration: 0,
                fingers: [
                    { x: a.currentX, y: a.currentY },
                    { x: b.currentX, y: b.currentY },
                ],
                center: {
                    x: (a.currentX + b.currentX) / 2,
                    y: (a.currentY + b.currentY) / 2,
                },
                scale,
            };

            this.onTouchObservable.notifyObservers(gesture);
        }
    };

    private _onPointerUp = (e: PointerEvent) => {
        const state = this._pointers.get(e.pointerId);
        if (!state) return;

        const duration = performance.now() - state.startTime;
        const dx = state.currentX - state.startX;
        const dy = state.currentY - state.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = distance / duration;

        const fingers = [{ x: state.currentX, y: state.currentY }];
        const timestamp = performance.now();

        if (distance < 10 && duration < 300) {
            const gesture: ITapGesture = {
                type: TouchGestureType.Tap,
                timestamp,
                duration,
                fingers,
            };

            this.onTouchObservable.notifyObservers(gesture);

            this._lastTapTime = timestamp;
        }

        if (distance > 30 && duration < 600) {
            const gesture: ISwipeGesture = {
                type: TouchGestureType.Swipe,
                timestamp,
                duration,
                fingers,
                distance,
                direction: this._computeSwipeDirection(dx, dy),
            };

            this.onTouchObservable.notifyObservers(gesture);
        }

        this._pointers.delete(e.pointerId);
    };

    private _distance(a: PointerState, b: PointerState): number {
        const dx = b.currentX - a.currentX;
        const dy = b.currentY - a.currentY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private _computeSwipeDirection(dx: number, dy: number): string {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx > ady) {
            return dx > 0 ? "right" : "left";
        } else {
            return dy > 0 ? "down" : "up";
        }
    }

    public dispose() {
        this._element.removeEventListener("pointerdown", this._onPointerDown);
        this._element.removeEventListener("pointermove", this._onPointerMove);
        this._element.removeEventListener("pointerup", this._onPointerUp);
        this._element.removeEventListener("pointercancel", this._onPointerUp);
    }
}
