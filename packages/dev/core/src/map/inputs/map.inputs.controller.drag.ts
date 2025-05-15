import { Observable } from "../../events";
import { IDragSource, IPointerDragEvent, IPointerSource } from "./map.inputs.interfaces";

export class PointerToDragController implements IDragSource {
    public readonly onDragObservable = new Observable<IPointerDragEvent>();

    private pointerState = new Map<number, { startX: number; startY: number; lastX: number; lastY: number; button: number }>();

    constructor(source: IPointerSource) {
        source.onPointerDownObservable.add(this._onStart);
        source.onPointerMoveObservable.add(this._onMove);
        source.onPointerUpObservable.add(this._onEnd);
        source.onPointerCancelObservable.add(this._onEnd);
    }

    private _onStart = (e: PointerEvent) => {
        this.pointerState.set(e.pointerId, {
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            button: e.button,
        });
    };

    private _onMove = (e: PointerEvent) => {
        const state = this.pointerState.get(e.pointerId);
        if (state) {
            const dx = e.clientX - state.lastX;
            const dy = e.clientY - state.lastY;
            const event: IPointerDragEvent = {
                type: "drag",
                pointerId: e.pointerId,
                button: state.button,
                startX: state.startX,
                startY: state.startY,
                x: e.clientX,
                y: e.clientY,
                deltaX: dx,
                deltaY: dy,
                timestamp: performance.now(),
                originalEvent: e,
            };
            this.onDragObservable.notifyObservers(event);
            state.lastX = e.clientX;
            state.lastY = e.clientY;
        }
    };

    private _onEnd = (e: PointerEvent) => {
        const state = this.pointerState.get(e.pointerId);
        if (state) {
            const dx = e.clientX - state.startX;
            const dy = e.clientY - state.startY;
            this.onDragObservable.notifyObservers({
                type: "end",
                pointerId: e.pointerId,
                button: state.button,
                startX: state.startX,
                startY: state.startY,
                x: e.clientX,
                y: e.clientY,
                deltaX: dx,
                deltaY: dy,
                timestamp: performance.now(),
                originalEvent: e,
            });
            this.pointerState.delete(e.pointerId);
        }
    };
}
