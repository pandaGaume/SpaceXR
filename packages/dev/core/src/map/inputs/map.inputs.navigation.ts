import { ITileNavigationApi } from "../../tiles";
import { IPointerTarget, IWheelTarget, IDragTarget } from "./map.inputs.interfaces";

export class InputsNavigationTarget<T> implements IPointerTarget<T>, IWheelTarget<T>, IDragTarget<T> {
    static readonly DEFAULT_ZOOM_INCREMENT = 0.1;

    _target: ITileNavigationApi<unknown>;
    _zoomIncrement?: number;

    _offsetX: number;
    _offsetY: number;

    _startX: number;
    _startY: number;

    _isDragging: boolean;
    _button: number;

    public constructor(target: ITileNavigationApi<unknown>, zoomIncrement?: number) {
        this._target = target;
        this._offsetX = 0;
        this._offsetY = 0;

        this._startX = 0;
        this._startY = 0;

        this._button = 0;
        this._isDragging = false;
        this._zoomIncrement = zoomIncrement ?? InputsNavigationTarget.DEFAULT_ZOOM_INCREMENT;
    }

    public get target(): ITileNavigationApi<unknown> {
        return this._target;
    }

    public get zoomIncrement(): number | undefined {
        return this._zoomIncrement;
    }

    public set zoomIncrement(value: number | undefined) {
        this._zoomIncrement = value;
    }

    public onWheel(src: T, delta: number): void {
        // replace delta by zoomIncrement if defined
        delta = this._zoomIncrement ? (delta < 0 ? this._zoomIncrement : -this._zoomIncrement) : delta;
        this._target.zoomMap(delta);
    }

    public onPointerMove(src: T, x: number, y: number): void {
        if (this._isDragging) {
            // compute the offset
            const dx = x - this._offsetX;
            const dy = y - this._offsetY;

            // mettre à jour les variables de décalage
            this._offsetX += dx;
            this._offsetY += dy;
            this.onDrag(src, dx, dy, this._button);
        }
    }

    public onPointerOut(src: T, x: number, y: number): void {
        // we let the drag continue.
    }

    public onPointerDown(src: T, x: number, y: number, buttonIndex: number): void {
        // regisyter start
        this._offsetX = this._startX = x;
        this._offsetY = this._startY = y;
        this._button = buttonIndex;
        this._isDragging = true;
        this.onBeginDrag(src, this._offsetX, this._offsetY, this._button);
    }

    public onPointerUp(src: T, x: number, y: number, buttonIndex: number): void {
        this._isDragging = false;
        // compute the offset
        const dx = x - this._offsetX;
        const dy = y - this._offsetY;
        this.onEndDrag(src, dx, dy, this._button);
    }

    public onPointerClick(src: T, x: number, y: number, buttonIndex: number): void {}
    public onPointerEnter(src: T, x: number, y: number): void {}
    public onBeginDrag(src: T, dx: number, dy: number, buttonIndex: number): void {}
    public onDrag(src: T, dx: number, dy: number, buttonIndex: number): void {
        switch (buttonIndex) {
            case 0: {
                // translate the center of the map according the drag displacement
                // then we have to negate the drag displacement
                this._target.translatePixelMap(-dx, -dy);
                break;
            }
            case 2: {
                this._target.rotateMap(dx);
                break;
            }
        }
    }
    public onEndDrag(src: T, dx: number, dy: number, buttonIndex: number): void {}
}
